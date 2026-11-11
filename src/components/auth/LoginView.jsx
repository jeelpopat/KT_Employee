import React, { useState } from 'react';
import { 
  Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, 
  Sparkles, Shield, User, CheckCircle2, AlertCircle, Phone,
  Calendar, Briefcase, MapPin, Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { clearApiCache } from '../../api/axios.js';
import { useApp } from '../../context/AppContext.jsx';
import { clearAuth } from '../../utils/auth.js';
import { showToast } from '../common/Toast.jsx';
import {
  EMPLOYEE_DEPARTMENTS_ROLES,
  ALL_EMPLOYEE_DEPARTMENTS,
  ALL_BLOOD_GROUPS,
  ALL_GENDERS
} from '../../utils/employeeRoles.js';
import whiteLogo from '../../assets/white logo.png';
import colorLogo from '../../assets/Logo.png';

export const LoginView = ({ 
  initialMode = 'login',
  onLoginSuccess, 
  onForgotPassword,
  onNavigateToRegister
}) => {
  const { loginUser } = useApp();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  
  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Register Form States (When in register mode)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState('employee');
  const [regDob, setRegDob] = useState('');
  const [regBloodGroup, setRegBloodGroup] = useState('');
  const [regGender, setRegGender] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regDepartment, setRegDepartment] = useState('');
  const [regDesignation, setRegDesignation] = useState('');
  const [regCustomDesignation, setRegCustomDesignation] = useState('');
  const [regAgreeTerms, setRegAgreeTerms] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  // -------------------------------------------------------------
  // LOGIN SUBMISSION HANDLER
  // -------------------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Clear previous session role, tokens and cache to prevent stale role leak
    if (typeof clearApiCache === 'function') {
      clearApiCache();
    }
    clearAuth();

    try {
      let response;
      try {
        response = await api.post('/api/users/login', {
          login: email.trim(),
          email: email.trim(),
          password: password,
          clientPlatform: 'web',
        });
      } catch (postErr) {
        if (postErr.response?.status === 404) {
          response = await api.post('/api/auth/login', {
            login: email.trim(),
            email: email.trim(),
            password: password,
            clientPlatform: 'web',
          });
        } else {
          throw postErr;
        }
      }

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
      let errorMessage = 'Invalid credentials or server unavailable. Please try again.';
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

  // -------------------------------------------------------------
  // REGISTRATION SUBMISSION HANDLER
  // -------------------------------------------------------------
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!regName.trim()) {
      setError('Full Name is required.');
      return;
    }

    if (!regEmail.trim()) {
      setError('Work Email Address is required.');
      return;
    }

    if (!regDepartment) {
      setError('Please select a Department.');
      return;
    }

    if (!regDesignation) {
      setError('Please select a Designation.');
      return;
    }

    if (regDesignation === 'Other' && !regCustomDesignation.trim()) {
      setError('Please specify your custom Designation in the text area.');
      return;
    }

    if (!regGender) {
      setError('Please select your Gender.');
      return;
    }

    if (!regAgreeTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setIsLoading(true);

    try {
      let formattedPhone = regPhone.trim();
      if (formattedPhone && !formattedPhone.startsWith('+')) {
        formattedPhone = `+91${formattedPhone.replace(/^0+/, '')}`;
      }

      const finalDesignation = regDesignation === 'Other'
        ? regCustomDesignation.trim()
        : regDesignation.trim();

      const payload = {
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        phone: formattedPhone || undefined,
        phoneNumber: formattedPhone || undefined,
        role: regRole.toLowerCase(),
        dob: regDob || undefined,
        bloodGroup: regBloodGroup || undefined,
        gender: regGender || undefined,
        address: regAddress.trim() || undefined,
        department: regDepartment || undefined,
        designation: finalDesignation || undefined,
        // Backend API schema compatibility fallback
        password: 'Kevalon@' + new Date().getFullYear()
      };

      try {
        await api.post('/api/auth/register', payload);
      } catch (authErr) {
        if (authErr.response?.status === 404) {
          await api.post('/api/users/register', payload);
        } else {
          throw authErr;
        }
      }

      clearAuth();
      if (typeof clearApiCache === 'function') {
        clearApiCache();
      }
      setEmail(regEmail.trim());
      setRegSuccess(false);
      setMode('login');
      showToast('Registration successful. Please sign in to continue.', 'success');
    } catch (err) {
      console.error('Registration error:', err);
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Registration failed. Please check your inputs and try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh w-full flex flex-col lg:flex-row lg:h-dvh lg:min-h-0 lg:overflow-hidden bg-[#FAFCFD] font-poppins selection:bg-[#068DCB] selection:text-white antialiased">
      
      {/* ============================================================== */}
      {/* LEFT COLUMN: HERO BRANDING & PRODUCT HIGHLIGHTS (DESKTOP)     */}
      {/* ============================================================== */}
      <div 
        className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-between p-8 text-white relative overflow-hidden lg:min-h-0 shrink-0"
        style={{
          background: 'linear-gradient(145deg, #022e43 0%, #034665 40%, #055c83 75%, #068DCB 100%)'
        }}
      >
        {/* Ambient Decorative Glow Orbs */}
        <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/3 w-72 h-72 bg-sky-300/10 rounded-full blur-2xl" />

        {/* Top Brand Logo & Version Pill */}
        <div className="relative z-10 flex items-center justify-between">
          <img 
            src={whiteLogo} 
            alt="Kevalon Technology" 
            className="h-10 w-auto object-contain drop-shadow-md"
          />
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-medium tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Enterprise Suite v2.4</span>
          </div>
        </div>

        {/* Center Hero Content */}
        <div className="relative z-10 my-auto py-4 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-sky-400/20 to-blue-500/20 border border-sky-300/30 text-sky-200 text-xs font-medium mb-4 backdrop-blur-xs">
            <Sparkles size={14} className="text-sky-300 animate-spin-slow" />
            <span>Intelligent HRMS & Operations Portal</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white leading-tight">
            Manage your team, attendance & payroll in one place
          </h1>
          <p className="mt-3 text-sm text-sky-100/80 leading-relaxed font-light">
            Empower your workforce with high-precision time tracking, geofenced mobile verification, automated salary disbursements, and itemized deduction management.
          </p>

          {/* Interactive Feature Cards */}
          <div className="mt-5 space-y-2.5">
            {[
              {
                icon: ShieldCheck,
                title: 'Automated Attendance & GPS Check-In',
                desc: 'Geofenced punch-in verification with live break and activity logs.'
              },
              {
                icon: Shield,
                title: 'Integrated Payroll & Deduction Engine',
                desc: 'Itemized deduction ledgers, legal compliance, and 1-click payslips.'
              },
              {
                icon: User,
                title: 'Role-Based Workspace Governance',
                desc: 'Dedicated views for Employees, Team Leaders, HR and Executives.'
              }
            ].map((f, idx) => (
              <div 
                key={idx}
                className="flex items-start gap-3.5 p-2.5 rounded-xl bg-white/10 hover:bg-white/15 transition-all border border-white/10 backdrop-blur-md"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-400/25 flex items-center justify-center shrink-0 border border-sky-300/30 text-sky-200 mt-0.5">
                  <f.icon size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white tracking-wide">{f.title}</h4>
                  <p className="text-[11px] text-sky-100/70 mt-0.5 leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Trust & Compliance Bar */}
        <div className="relative z-10 pt-6 border-t border-white/15 flex items-center justify-between text-xs text-sky-200/70">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              99.98% Uptime
            </span>
            <span>•</span>
            <span>256-Bit SSL Encrypted</span>
          </div>
          <span>© {new Date().getFullYear()} Kevalon Technology</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* RIGHT COLUMN: INTERACTIVE AUTH PANEL                          */}
      {/* ============================================================== */}
      <div className="w-full lg:w-7/12 xl:w-1/2 flex flex-col justify-between p-6 sm:p-10 xl:px-14 xl:py-8 overflow-y-auto lg:min-h-0">
        
        {/* Mobile Header with Logo */}
        <div className="flex lg:hidden items-center justify-between mb-8 pb-4 border-b border-slate-100">
          <img 
            src={colorLogo} 
            alt="Kevalon Technology" 
            className="h-8 w-auto object-contain"
          />
          <div className="flex items-center gap-1 text-xs font-semibold text-[#0088cc]">
            <ShieldCheck size={14} />
            <span>HRMS Portal</span>
          </div>
        </div>

        <div className={`${mode === 'register' ? 'max-w-xl' : 'max-w-md'} w-full mx-auto my-auto py-4 transition-all duration-300`}>
          
          {/* Segmented Mode Switcher: Sign In vs Create Account */}
          <div className="p-1 bg-slate-100 rounded-xl flex items-center mb-7 border border-slate-200/80">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-white text-[#0088cc] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? 'bg-white text-[#0088cc] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Create Account</span>
            </button>
          </div>

          {/* ========================================================== */}
          {/* VIEW A: SIGN IN FORM                                       */}
          {/* ========================================================== */}
          {mode === 'login' && (
            <div className="animate-fade-in space-y-6">
              
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Welcome Back
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Enter your credentials to access your Kevalon workspace.
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-xs text-rose-700 flex items-start gap-2.5 animate-fade-in">
                  <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Official Email or Username <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@kevalon.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={onForgotPassword}
                      className="text-2xs font-semibold text-[#0088cc] hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-[#0088cc] border-slate-300 focus:ring-[#0088cc] cursor-pointer"
                    />
                    <span className="text-xs text-slate-500">Remember this device</span>
                  </label>
                  <span className="text-[11px] text-slate-400">SSL Protected</span>
                </div>

                {/* Submit Primary Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 btn-brand-primary text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Workspace</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Toggle Note */}
              <div className="pt-2 text-center border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  New to Kevalon Technology?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError(''); }}
                    className="font-semibold text-[#0088cc] hover:underline cursor-pointer ml-1"
                  >
                    Create an account
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW B: CREATE ACCOUNT / REGISTER FORM                     */}
          {/* ========================================================== */}
          {mode === 'register' && (
            <div className="animate-fade-in space-y-6">
              
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Create your account
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Set up your official Kevalon HRMS workspace profile.
                </p>
              </div>

              {regSuccess ? (
                /* Registration Success Card */
                <div className="bg-white rounded-2xl border border-emerald-200/80 p-7 shadow-xs text-center space-y-4 animate-fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-xs">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                      Account Registered!
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                      Your workspace account has been created for <span className="font-semibold text-slate-700">{regEmail}</span>. You can now sign in to your workspace.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setRegSuccess(false); setMode('login'); }}
                    className="w-full h-11 btn-brand-primary text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm cursor-pointer hover:shadow-md transition"
                  >
                    <span>Proceed to Sign In</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                /* Register Form */
                <form onSubmit={handleRegister} className="space-y-4">
                  
                  {/* Error Alert */}
                  {error && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-xs text-rose-700 flex items-start gap-2.5 animate-fade-in">
                      <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                      <span className="font-medium">{error}</span>
                    </div>
                  )}

                  {/* Row 1: Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition"
                      />
                    </div>
                  </div>

                  {/* Row 2: Work Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Work Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="name@kevalon.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition"
                      />
                    </div>
                  </div>

                  {/* Row 3: Phone & Designated Role (Grid) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="tel"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Role <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Shield size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                          value={regRole}
                          onChange={(e) => setRegRole(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition cursor-pointer"
                        >
                          <option value="employee">Employee</option>
                          <option value="teamlead">Team Leader</option>
                          <option value="hr">HR Executive</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Row 4: DOB, Gender & Blood Group (Grid) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Date of Birth (DOB) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Date of Birth (DOB)
                      </label>
                      <div className="relative">
                        <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="date"
                          value={regDob}
                          onChange={(e) => setRegDob(e.target.value)}
                          max={new Date().toISOString().split('T')[0]}
                          className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition"
                        />
                      </div>
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Gender <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                          value={regGender}
                          onChange={(e) => setRegGender(e.target.value)}
                          required
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition cursor-pointer"
                        >
                          <option value="">Select Gender</option>
                          {ALL_GENDERS.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Blood Group */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Blood Group
                      </label>
                      <div className="relative">
                        <Activity size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                          value={regBloodGroup}
                          onChange={(e) => setRegBloodGroup(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition cursor-pointer"
                        >
                          <option value="">Select Blood Group</option>
                          {ALL_BLOOD_GROUPS.map((bg) => (
                            <option key={bg} value={bg}>{bg}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Row 5: Department & Designation (Dependent Dropdown) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Department */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Department <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Briefcase size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                          value={regDepartment}
                          required
                          onChange={(e) => {
                            const newDept = e.target.value;
                            setRegDepartment(newDept);
                            const rolesInDept = EMPLOYEE_DEPARTMENTS_ROLES[newDept] || [];
                            if (!rolesInDept.includes(regDesignation) && regDesignation !== 'Other') {
                              setRegDesignation('');
                              setRegCustomDesignation('');
                            }
                          }}
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition cursor-pointer"
                        >
                          <option value="">Select Department</option>
                          {ALL_EMPLOYEE_DEPARTMENTS.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Designation */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Designation <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Briefcase size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                          value={regDesignation}
                          required
                          disabled={!regDepartment}
                          onChange={(e) => {
                            setRegDesignation(e.target.value);
                            if (e.target.value !== 'Other') {
                              setRegCustomDesignation('');
                            }
                          }}
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          <option value="">
                            {regDepartment ? 'Select Designation' : 'Select Department First'}
                          </option>
                          {regDepartment && EMPLOYEE_DEPARTMENTS_ROLES[regDepartment]?.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                          {regDepartment && (
                            <option value="Other">Other (Specify Custom Role)</option>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Row 6: Custom Designation Textarea (When "Other" is selected) */}
                  {regDesignation === 'Other' && (
                    <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-100 animate-fade-in space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-[#0088cc]">
                          Specify Custom Designation / Role <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400">Department: {regDepartment}</span>
                      </div>
                      <textarea
                        rows={2}
                        required
                        value={regCustomDesignation}
                        onChange={(e) => setRegCustomDesignation(e.target.value)}
                        placeholder="e.g. Senior Cloud Architect, Team Lead, Associate Consultant..."
                        className="w-full p-2.5 bg-white border border-sky-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition resize-none"
                      />
                    </div>
                  )}

                  {/* Row 7: Residential / Communication Address */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Address
                    </label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3.5 top-3 text-slate-400" />
                      <textarea
                        rows={2}
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                        placeholder="Residential address / communication address..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition resize-none"
                      />
                    </div>
                  </div>

                  {/* Row 8: Terms & Conditions Checkbox */}
                  <div className="flex items-start gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="regTerms"
                      checked={regAgreeTerms}
                      onChange={(e) => setRegAgreeTerms(e.target.checked)}
                      aria-label="I agree to the Terms of Service and Privacy Policy"
                      className="w-4 h-4 rounded text-[#0088cc] border-slate-300 focus:ring-[#0088cc] cursor-pointer mt-0.5"
                    />
                    <span className="text-[11px] text-slate-500 select-none leading-relaxed">
                      I agree to the{' '}
                      <Link to="/terms-of-service" className="font-medium text-[#0088cc] hover:underline">Terms of Service</Link>
                      {' '}and{' '}
                      <Link to="/privacy" className="font-medium text-[#0088cc] hover:underline">Privacy Policy</Link>.
                    </span>
                  </div>

                  {/* Submit CTA */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 btn-brand-primary text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition cursor-pointer disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Creating Workspace Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Workspace Account</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>

                  {/* Back to Sign In Link */}
                  <div className="text-center pt-1">
                    <p className="text-xs text-slate-500">
                      Already registered?{' '}
                      <button
                        type="button"
                        onClick={() => { setMode('login'); setError(''); }}
                        className="font-semibold text-[#0088cc] hover:underline cursor-pointer ml-1"
                      >
                        Sign In
                      </button>
                    </p>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>

        {/* Panel Footer */}
        <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <span>Kevalon Technology HRMS Suite</span>
          <div className="flex items-center gap-4">
            <Link to="/security-policy" className="transition hover:text-slate-600">Security Policy</Link>
            <Link to="/privacy" className="transition hover:text-slate-600">Privacy</Link>
            <Link to="/support" className="transition hover:text-slate-600">Support</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
