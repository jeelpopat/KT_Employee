import React from 'react';
import { LoginView } from '../components/auth/LoginView.jsx';
import { useNavigate } from 'react-router-dom';

function Login({ setIsAuthenticated }) {
  const navigate = useNavigate();

  return (
    <LoginView
      onLoginSuccess={() => {
        if (setIsAuthenticated) setIsAuthenticated(true);
        navigate('/dashboard', { replace: true });
      }}
      onForgotPassword={() => navigate('/forgot-password')}
    />
  );
}

export default Login;
