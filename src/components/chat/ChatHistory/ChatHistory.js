import React, { useState, useEffect } from 'react';
import { Typography, List, Card, message, Spin } from 'antd';
import { MessageOutlined, ClockCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import './ChatHistory.css';

const { Title, Text } = Typography;

const ChatHistory = ({ onSelectChat, user }) => {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);

  // 获取会话列表
  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/chat/sessions`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`
          }
        }
      );
      setSessions(response.data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      message.error('获取会话列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取会话详情
  const handleSessionSelect = async (sessionId) => {
    try {
      setSelectedId(sessionId);
      setSessionLoading(true);
      
      // 先从会话列表中获取基本信息
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        throw new Error('会话不存在');
      }

      // 获取完整会话历史
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/chat/sessions/${sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`
          }
        }
      );
      
      if (response.data && response.data.messages) {
        // 将消息数组和会话 ID 传递给父组件
        onSelectChat(
          response.data.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            created_at: msg.timestamp,
            id: msg.id || `${sessionId}_${msg.timestamp}`
          })),
          sessionId  // 添加 sessionId 参数
        );
      } else {
        throw new Error('会话数据格式不正确');
      }

    } catch (error) {
      console.error('Error handling session:', error);
      message.error(error.message || '获取会话详情失败');
      setSelectedId(null);
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [user.token]);

  return (
    <div className="chat-history">
      <Title level={4}>聊天记录</Title>
      <Spin spinning={loading}>
        <List
          dataSource={sessions}
          renderItem={(session) => (
            <List.Item key={session.id}>
              <Card 
                className={`history-card ${selectedId === session.id ? 'selected' : ''}`}
                onClick={() => handleSessionSelect(session.id)}
                hoverable
              >
                <Spin spinning={sessionLoading && selectedId === session.id}>
                  <div className="history-title">
                    <Text strong>{session.title || '新会话'}</Text>
                  </div>
                  <div className="history-preview">
                    <Text type="secondary" ellipsis>{session.last_message}</Text>
                  </div>
                  <div className="history-footer">
                    <span className="history-time">
                      <ClockCircleOutlined /> 
                      <Text type="secondary">
                        {new Date(session.created_at).toLocaleString()}
                      </Text>
                    </span>
                    <span className="history-icon">
                      <MessageOutlined />
                    </span>
                  </div>
                </Spin>
              </Card>
            </List.Item>
          )}
        />
      </Spin>
    </div>
  );
};

export default ChatHistory; 