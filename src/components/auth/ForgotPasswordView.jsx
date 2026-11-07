import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, KeyRound, ArrowRight, ArrowLeft, Sparkles, Shield, User } from 'lucide-react';
import api from '../../api/axios.js';
import whiteLogo from '../../assets/white logo.png';
import colorLogo from '../../assets/Logo.png';

export const ForgotPasswordView = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError('Please enter your registered email address.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      try {
        await api.post('/api/users/forgot-password', { email });
      } catch (postErr) {
        if (postErr.response?.status === 404) {
          await api.post('/api/auth/forgot-password', { email });
        } else {
          throw postErr;
        }
      }
      setSuccess(true);
    } catch (err) {
      console.error('Forgot password error:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to send reset link. Please check your email or contact system administration.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#FAFCFD] font-poppins selection:bg-[#068DCB] selection:text-white antialiased">
      
      {/* Left Column: Hero Branding */}
      <div 
        className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-between p-10 xl:p-14 text-white relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #022e43 0%, #034665 40%, #055c83 75%, #068DCB 100%)'
        }}
      >
        <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex items-center justify-between">
          <img 
            src={whiteLogo} 
            alt="Kevalon Technology" 
            className="h-10 w-auto object-contain drop-shadow-md"
          />
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-medium tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Account Recovery</span>
          </div>
        </div>

        <div className="relative z-10 my-auto py-8 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-sky-400/20 to-blue-500/20 border border-sky-300/30 text-sky-200 text-xs font-medium mb-6 backdrop-blur-xs">
            <Sparkles size={14} className="text-sky-300" />
            <span>Secure Password Retrieval</span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-bold tracking-tight text-white leading-tight">
            Regain access to your Kevalon workspace
          </h1>
          <p className="mt-4 text-sm xl:text-base text-sky-100/80 leading-relaxed font-light">
            We use end-to-end encrypted password verification tokens to keep your payroll records, employee documents, and attendance logs strictly confidential.
          </p>

          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/10 border border-white/10 backdrop-blur-md">
              <KeyRound size={18} className="text-sky-300 shrink-0" />
              <p className="text-xs text-sky-100">Direct one-time secure password reset link sent to your inbox.</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-6 border-t border-white/15 flex items-center justify-between text-xs text-sky-200/70">
          <span>Enterprise Security Protocol</span>
          <span>© {new Date().getFullYear()} Kevalon Technology</span>
        </div>
      </div>

      {/* Right Column: Reset Form */}
      <div className="w-full lg:w-7/12 xl:w-1/2 flex flex-col justify-between p-6 sm:p-10 xl:p-14 overflow-y-auto">
        
        <div className="flex lg:hidden items-center justify-between mb-8 pb-4 border-b border-slate-100">
          <img 
            src={colorLogo} 
            alt="Kevalon Technology" 
            className="h-8 w-auto object-contain"
          />
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-xs font-semibold text-[#0088cc] hover:underline cursor-pointer flex items-center gap-1"
          >
            <ArrowLeft size={13} />
            <span>Back to Sign In</span>
          </button>
        </div>

        <div className="max-w-md w-full mx-auto my-auto">
          
          <div className="mb-6">
            <button
              type="button"
              onClick={onBackToLogin}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#0088cc] mb-4 transition cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to Sign In</span>
            </button>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Forgot Password
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {success
                ? "Check your inbox for the secure reset link."
                : "Enter your registered email address to receive password reset instructions."}
            </p>
          </div>

          {success ? (
            <div className="bg-white rounded-2xl border border-emerald-200/80 p-7 shadow-xs text-center space-y-4 animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-xs">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Reset Link Dispatched
                </h3>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                  We've sent a password reset link to <span className="font-semibold text-slate-800">{email}</span>. Please check your inbox and spam folder.
                </p>
              </div>
              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full h-11 btn-brand-primary text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm cursor-pointer hover:shadow-md transition"
              >
                <span>Return to Sign In</span>
                <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-xs text-rose-700 flex items-start gap-2.5 animate-fade-in">
                  <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Registered Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@kevalon.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 btn-brand-primary text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Instructions</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="text-xs font-semibold text-[#0088cc] hover:underline cursor-pointer"
                >
                  Remember your password? Sign In
                </button>
              </div>
            </form>
          )}

        </div>

        <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <span>Kevalon Technology HRMS Suite</span>
          <span>Assistance: support@kevalon.com</span>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordView;
