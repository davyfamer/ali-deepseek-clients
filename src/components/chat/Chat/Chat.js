import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layout, Input, Button, Avatar, Typography } from 'antd';
import { 
  SendOutlined, 
  UploadOutlined, 
  UserOutlined, 
  RobotOutlined,
  MenuOutlined,
  CloseOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import ChatHistory from '../ChatHistory';
import './Chat.css';

const { Content, Sider } = Layout;
const { TextArea } = Input;
const { Text } = Typography;

const Chat = ({ user }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [siderVisible, setSiderVisible] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 将 fetchChatHistory 移到这里，并用 useCallback 包装
  const fetchChatHistory = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/chat/sessions`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`
          }
        }
      );
      
      // 按时间分组聊天记录
      const groupedHistory = groupChatHistory(response.data);
      setChatHistory(groupedHistory);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      if (error.response?.status === 401) {
        // 处理认证失败
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.reload();
      }
    }
  }, [user.token]); // 添加依赖

  useEffect(() => {
    scrollToBottom();
    fetchChatHistory();
  }, [messages, user, fetchChatHistory]);

  // 检测是否为移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 处理历史记录面板的显示/隐藏
  const toggleSider = () => {
    setSiderVisible(!siderVisible);
  };

  // 关闭历史记录面板
  const closeSider = () => {
    setSiderVisible(false);
  };

  const groupChatHistory = (history) => {
    // 按日期分组
    const groups = history.reduce((acc, message) => {
      const date = new Date(message.created_at).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(message);
      return acc;
    }, {});

    // 转换为数组格式
    return Object.entries(groups).map(([date, messages]) => ({
      date,
      messages,
      id: messages[0].id // 使用第一条消息的ID作为组ID
    }));
  };

  const handleHistorySelect = (messages, sessionId) => {
    setCurrentSessionId(sessionId);
    setMessages(messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      id: msg.id,
      created_at: msg.created_at
    })));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() && !fileContent) return;

    let userMessage = { role: 'user', content: input };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const requestBody = {
        messages: [userMessage],
      };

      if (currentSessionId) {
        requestBody.sessionId = currentSessionId;
      }

      if (fileContent) {
        requestBody.documentContext = fileContent;
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('认证失败，请重新登录');
        }
        throw new Error('Network response was not ok');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      const assistantMessage = { role: 'assistant', content: '' };
      setMessages(prev => [...prev, assistantMessage]);

      let fullContent = '';
      let currentContent = '';
      let newSessionId = currentSessionId;

      setIsTyping(true);
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(5);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                currentContent += parsed.content;
                
                if (parsed.sessionId && !newSessionId) {
                  newSessionId = parsed.sessionId;
                  setCurrentSessionId(newSessionId);
                }

                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: currentContent
                  };
                  return newMessages;
                });
              }
            } catch (e) {
              if (!data.includes('[DONE]')) {
                console.error('Error parsing JSON:', e);
              }
            }
          }
        }
        fullContent = currentContent;
      }
      
      setSelectedFile(null);
      setFileContent('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: error.message || '抱歉，发生了一些错误，请稍后重试。' 
      }]);
      
      if (error.message === '认证失败，请重新登录') {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.reload();
      }
    } finally {
      setIsTyping(false);
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    try {
      if (file.type === 'application/pdf') {
        // 上传 PDF 文件到服务器进行解析
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.token}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error('文件上传失败');
        }

        const data = await response.json();
        setFileContent(data.fileContent);
        setSelectedFile(file);

        // 添加系统提示和文件内容消息
        setMessages(prev => [...prev, 
          { 
            role: 'system', 
            content: '你是一个专业的文档分析助手。请仔细阅读用户上传的文档内容，并根据用户的具体问题提供准确、相关的答案。在回答时，你应该：1. 直接引用文档中的相关内容 2. 提供清晰的解释 3. 如果问题涉及文档中没有的内容，要明确指出。' 
          },
          { 
            role: 'user', 
            content: `已上传文件: ${file.name}\n\n文档内容:\n${data.fileContent}` 
          },
          { 
            role: 'assistant', 
            content: '我已经阅读了文档内容。请告诉我您想了解什么，我会帮您分析文档并回答问题。' 
          }
        ]);

      } else if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target.result;
          setFileContent(content);
          setSelectedFile(file);
          
          // 添加系统提示和文件内容消息
          setMessages(prev => [...prev, 
            { 
              role: 'system', 
              content: '你是一个专业的文档分析助手。请仔细阅读用户上传的文档内容，并根据用户的具体问题提供准确、相关的答案。在回答时，你应该：1. 直接引用文档中的相关内容 2. 提供清晰的解释 3. 如果问题涉及文档中没有的内容，要明确指出。' 
            },
            { 
              role: 'user', 
              content: `已上传文件: ${file.name}\n\n文档内容:\n${content}` 
            },
            { 
              role: 'assistant', 
              content: '我已经阅读了文档内容。请告诉我您想了解什么，我会帮您分析文档并回答问题。' 
            }
          ]);
        };
        reader.readAsText(file);
      } else {
        throw new Error('不支持的文件类型');
      }
    } catch (error) {
      console.error('File handling error:', error);
      setMessages(prev => [...prev, 
        { role: 'assistant', content: '抱歉，文件处理失败。请确保文件格式正确（支持PDF和TXT）。' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout className="chat-layout">
      {isMobile && (
        <div 
          className="history-toggle" 
          onClick={toggleSider}
        >
          {siderVisible ? <CloseOutlined /> : <MenuOutlined />}
        </div>
      )}
      
      {isMobile && (
        <div 
          className={`history-mask ${siderVisible ? 'visible' : ''}`}
          onClick={closeSider}
        />
      )}

      <Sider 
        width={300} 
        theme="light" 
        className={`chat-sider ${siderVisible ? 'visible' : ''}`}
      >
        <ChatHistory 
          user={user}
          onSelectChat={(messages, sessionId) => {
            handleHistorySelect(messages, sessionId);
            if (isMobile) {
              closeSider();
            }
          }}
        />
      </Sider>

      <Layout className="chat-main">
        <Content className="chat-content">
          <div className="messages">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`message ${message.role === 'user' ? 'user' : 'assistant'}`}
              >
                <div className="message-header">
                  <Avatar 
                    icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    className={message.role === 'user' ? 'user-avatar' : 'assistant-avatar'}
                  />
                  <Text type="secondary" className="message-time">
                    {new Date().toLocaleTimeString()}
                  </Text>
                </div>
                <div className="message-content">
                  {message.role === 'user' ? (
                    message.content
                  ) : (
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({node, inline, className, children, ...props}) {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <div className="code-block">
                              <div className="code-header">
                                <span>{match[1]}</span>
                              </div>
                              <pre className={className}>
                                <code {...props} className={className}>
                                  {children}
                                </code>
                              </pre>
                            </div>
                          ) : (
                            <code {...props} className={className}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="input-area">
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedFile ? "请输入您对文件内容的问题..." : "输入您的问题..."}
              disabled={isLoading}
              onPressEnter={(e) => {
                if (!e.shiftKey && !isMobile) { // 在移动端禁用回车发送
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              autoSize={{ minRows: 2, maxRows: isMobile ? 4 : 6 }}
            />
            <div className="button-group">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                accept=".txt,.pdf"
              />
              <Button
                icon={<UploadOutlined />}
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                {isMobile ? '' : (selectedFile ? '更换文件' : '上传文件')}
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isMobile ? '' : '发送'}
              </Button>
            </div>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Chat; 