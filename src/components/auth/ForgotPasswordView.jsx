import React, { useState } from 'react';
import { Mail, ArrowLeft, Loader2, Send, CheckCircle2 } from 'lucide-react';
import logo from '../../assets/Logo.png';
import api from '../../api/axios.js';

export const ForgotPasswordView = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError('Please enter your registered email address.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      // POST /api/users/forgot-password flow
      await api.post('/api/users/forgot-password', { email });
      setSuccessMsg(`Reset link sent to ${email}. Please check your inbox.`);
      setEmail(''); // Clear the input on success
    } catch (err) {
      console.error('Forgot password error:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to send reset link. Please try again later.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-xl overflow-hidden transition-colors">

        {/* Header */}
        <div className="px-6 py-8 flex flex-col items-center border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-center">
          <div className=" mb-5">
            <img src={logo} alt="Kevalon Technology" className="h-10 w-auto object-contain scale-[4]" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Reset Password
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            Enter your email and we'll send you a recovery link.
          </p>
        </div>

        {/* Form */}
        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-md text-red-700 dark:text-red-400 text-sm font-medium text-center">
                {error}
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-md text-green-700 dark:text-green-400 text-sm font-medium text-center flex flex-col items-center gap-2">
                <CheckCircle2 size={24} className="text-green-500" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Email Input (Hide if success to keep UI clean) */}
            {!successMsg && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@kevalon.com"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
              </div>
            )}

            {/* Submit Button (Hide if success) */}
            {!successMsg && (
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed transition-all mt-6 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Sending Link...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send Reset Link
                  </>
                )}
              </button>
            )}

            {/* Back to Login Link */}
            <div className="pt-4 flex justify-center border-t border-slate-100 dark:border-slate-800 mt-6">
              <button
                type="button"
                onClick={onBackToLogin}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                <ArrowLeft size={16} />
                Back to Sign In
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};