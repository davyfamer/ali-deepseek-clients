import React, { useState, useEffect } from 'react';
import Chat from './components/chat/Chat';
import Login from './components/auth/Login';
import './App.css';
import 'antd/dist/reset.css';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (token && username) {
      setUser({ token, username });
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
  };

  return (
    <div className="App">
      {user ? (
        <>
          <div className="header">
            <span>Welcome, {user.username}</span>
            <button onClick={handleLogout}>Logout</button>
          </div>
          <div className="content">
            <Chat user={user} />
          </div>
        </>
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App; 