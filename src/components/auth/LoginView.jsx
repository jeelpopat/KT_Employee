import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import api from '../../api/axios.js';
import { useApp } from '../../context/AppContext.jsx';
import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';

export const LoginView = ({ onLoginSuccess, onForgotPassword }) => {
  const { loginUser } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/api/users/login', {
        login: email,
        email: email,
        password: password
      });

      const data = response.data || {};

      // Store session details from backend
      const token = data.token || data.accessToken || data.data?.token;
      if (token) {
        localStorage.setItem('token', token);
        localStorage.setItem('auth_token', token);
        localStorage.setItem('isAuthenticated', 'true');
      }
      const user = data.user || data.data?.user || { email };

      // Combine all response properties so role or employee metadata is preserved
      const combinedUserData = {
        ...data,
        ...(data.data || {}),
        ...user,
        email: email
      };

      // Update session in AppContext and resolve role via API
      if (loginUser) {
        await loginUser(combinedUserData, token);
      }

      // Notify App that login is complete
      if (onLoginSuccess) {
        onLoginSuccess(combinedUserData);
      }

    } catch (err) {
      console.error('Login error:', err);
      let errorMessage = 'Server is unavailable. Please try again.';
      if (err.message && err.message.toLowerCase().includes('unauthorized')) {
        errorMessage = err.message;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 antialiased font-sans">
      <div className="w-full max-w-sm rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs animate-fade-in">
        
        {/* Header Icon & Title matching KT-admin */}
        <div className="mb-5 text-center flex flex-col items-center">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
            Welcome Back
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Sign in to access your portal workspace
          </p>
        </div>

        {/* Form matching KT-admin */}
        <form onSubmit={handleLogin} className="space-y-3.5">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="employee@kevalon.com"
            leftIcon={Mail}
            required
          />

          <div>
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={Lock}
              rightIcon={showPassword ? EyeOff : Eye}
              onRightIconClick={() => setShowPassword(!showPassword)}
              required
            />
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
          </div>

          {error && (
            <div className="p-2 rounded-lg bg-rose-50 border border-rose-200/60 text-xs font-medium text-rose-600 text-center">
              {error}
            </div>
          )}

          <Button
            type="submit"
            isLoading={isLoading}
            className="w-full py-2 text-xs font-semibold"
          >
            {isLoading ? "Signing In..." : "Sign In"}
          </Button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            Kevalon Technology © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginView;