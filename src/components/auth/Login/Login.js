import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';

const Login = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}${endpoint}`, 
        formData
      );
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('username', response.data.username);
      
      onLogin(response.data);
    } catch (error) {
      setError(error.response?.data?.error || 'An error occurred');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>{isRegister ? 'Register' : 'Login'}</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <input
          type="text"
          name="username"
          placeholder="Username"
          value={formData.username}
          onChange={handleChange}
          required
        />
        
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
        />
        
        {isRegister && (
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        )}
        
        <button type="submit">
          {isRegister ? 'Register' : 'Login'}
        </button>
        
        <p onClick={() => setIsRegister(!isRegister)} className="toggle-form">
          {isRegister 
            ? 'Already have an account? Login' 
            : 'Need an account? Register'}
        </p>
      </form>
    </div>
  );
};

export default Login; 