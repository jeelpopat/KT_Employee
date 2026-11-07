import React, { useState } from 'react';
import { 
  User, Mail, Lock, Phone, Shield, Eye, EyeOff, 
  CheckCircle2, AlertCircle, ArrowRight, Sparkles 
} from 'lucide-react';
import api from '../../api/axios.js';
import whiteLogo from '../../assets/white logo.png';
import colorLogo from '../../assets/Logo.png';

export const RegisterView = ({ onBackToLogin, onRegisterSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('employee');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Password Strength Calculation
  const hasMinLength = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const strengthScore = [hasMinLength, hasLetter, hasNumber].filter(Boolean).length;
  const strengthColor = strengthScore === 3 ? 'bg-emerald-500' : strengthScore === 2 ? 'bg-amber-500' : 'bg-rose-500';
  const strengthLabel = strengthScore === 3 ? 'Strong' : strengthScore === 2 ? 'Medium' : 'Weak';

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!hasMinLength || !hasLetter || !hasNumber) {
      setError('Password must be at least 8 characters and include at least one letter and one number.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    if (!agreeTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setIsLoading(true);

    try {
      // Format phone number to E.164 if provided
      let formattedPhone = phone.trim();
      if (formattedPhone && !formattedPhone.startsWith('+')) {
        formattedPhone = `+91${formattedPhone.replace(/^0+/, '')}`;
      }

      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: role.toLowerCase(),
        phone: formattedPhone || undefined,
        phoneNumber: formattedPhone || undefined
      };

      // Try /api/auth/register first, fallback to /api/users/register
      try {
        await api.post('/api/auth/register', payload);
      } catch (authErr) {
        if (authErr.response?.status === 404) {
          await api.post('/api/users/register', payload);
        } else {
          throw authErr;
        }
      }

      setSuccess(true);
      if (onRegisterSuccess) {
        onRegisterSuccess(payload);
      }
    } catch (err) {
      console.error('Registration error:', err);
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Registration failed. Please check your details and try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#FAFCFD] font-poppins selection:bg-[#068DCB] selection:text-white antialiased">
      
      {/* ============================================================== */}
      {/* LEFT COLUMN: HERO BRANDING & FEATURE SHOWCASE (DESKTOP)       */}
      {/* ============================================================== */}
      <div 
        className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-between p-10 xl:p-14 text-white relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #022e43 0%, #034665 40%, #055c83 75%, #068DCB 100%)'
        }}
      >
        {/* Ambient Decorative Blurs */}
        <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/3 w-72 h-72 bg-sky-300/10 rounded-full blur-2xl" />

        {/* Top Brand Logo */}
        <div className="relative z-10 flex items-center justify-between">
          <img 
            src={whiteLogo} 
            alt="Kevalon Technology" 
            className="h-10 w-auto object-contain drop-shadow-md"
          />
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-medium tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>HRMS Portal v2.4</span>
          </div>
        </div>

        {/* Center Hero Content */}
        <div className="relative z-10 my-auto py-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-sky-400/20 to-blue-500/20 border border-sky-300/30 text-sky-200 text-xs font-medium mb-6 backdrop-blur-xs">
            <Sparkles size={14} className="text-sky-300 animate-spin-slow" />
            <span>Unified Team Management Platform</span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-bold tracking-tight text-white leading-tight">
            Create your account & join your workspace
          </h1>
          <p className="mt-4 text-sm xl:text-base text-sky-100/80 leading-relaxed font-light">
            Empower your organization with seamless attendance tracking, real-time geofenced check-ins, automated salary disbursements, and role-based operational transparency.
          </p>

          {/* Feature Badges Grid */}
          <div className="mt-8 space-y-3">
            {[
              {
                icon: Shield,
                title: 'Role-Based Access Governance',
                desc: 'Fine-grained permissions for Admin, HR, Team Leads, and Employees.'
              },
              {
                icon: CheckCircle2,
                title: 'Real-Time Punch & Verification',
                desc: 'Geofenced office check-in with live break and task tracking.'
              },
              {
                icon: User,
                title: 'Comprehensive Employee Records',
                desc: 'Secure document vaults, deduction ledgers, and payslip downloads.'
              }
            ].map((f, idx) => (
              <div 
                key={idx}
                className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/10 hover:bg-white/15 transition-all border border-white/10 backdrop-blur-md"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-400/20 flex items-center justify-center shrink-0 border border-sky-300/30 text-sky-200 mt-0.5">
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

        {/* Bottom Trust Line */}
        <div className="relative z-10 pt-6 border-t border-white/15 flex items-center justify-between text-xs text-sky-200/70">
          <span>Enterprise Grade • 256-Bit SSL</span>
          <span>© {new Date().getFullYear()} Kevalon Technology</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* RIGHT COLUMN: REGISTRATION FORM                               */}
      {/* ============================================================== */}
      <div className="w-full lg:w-7/12 xl:w-1/2 flex flex-col justify-between p-6 sm:p-10 xl:p-14 overflow-y-auto">
        
        {/* Mobile Header with Logo */}
        <div className="flex lg:hidden items-center justify-between mb-8 pb-4 border-b border-slate-100">
          <img 
            src={colorLogo} 
            alt="Kevalon Technology" 
            className="h-8 w-auto object-contain"
          />
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-xs font-semibold text-[#0088cc] hover:underline cursor-pointer"
          >
            Sign In instead
          </button>
        </div>

        <div className="max-w-md w-full mx-auto my-auto">
          
          {/* Form Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xs font-bold uppercase tracking-widest text-[#0088cc] bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100">
                New User Registration
              </span>
              <button
                type="button"
                onClick={onBackToLogin}
                className="hidden lg:inline-flex text-xs font-medium text-slate-500 hover:text-[#0088cc] transition cursor-pointer"
              >
                Already registered? <span className="font-semibold text-[#0088cc] ml-1 hover:underline">Sign In</span>
              </button>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Create your account
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Enter your official details to set up your Kevalon HRMS credentials.
            </p>
          </div>

          {/* Success State Screen */}
          {success ? (
            <div className="bg-white rounded-2xl border border-emerald-200/80 p-7 shadow-xs text-center space-y-4 animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-xs">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Registration Successful!
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                  Your account has been created for <span className="font-semibold text-slate-700">{email}</span>. You can now sign in to your workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full h-11 btn-brand-primary text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm cursor-pointer hover:shadow-md transition"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            /* Registration Form */
            <form onSubmit={handleRegister} className="space-y-4">
              
              {/* Error Alert */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 text-xs text-rose-700 flex items-start gap-2.5 animate-fade-in">
                  <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition"
                  />
                </div>
              </div>

              {/* Work Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Official Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@kevalon.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition"
                  />
                </div>
              </div>

              {/* Phone & Role (Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Designated Role <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Shield size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition cursor-pointer"
                    >
                      <option value="employee">Employee</option>
                      <option value="teamlead">Team Leader</option>
                      <option value="hr">HR Executive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password <span className="text-rose-500">*</span>
                </label>
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

                {/* Password Strength Indicator */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1.5 animate-fade-in">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Security strength:</span>
                      <span className="font-semibold text-slate-700">{strengthLabel}</span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden flex gap-1">
                      <div className={`h-full flex-1 rounded-full ${strengthColor}`} />
                      <div className={`h-full flex-1 rounded-full ${strengthScore >= 2 ? strengthColor : 'bg-slate-200'}`} />
                      <div className={`h-full flex-1 rounded-full ${strengthScore === 3 ? strengthColor : 'bg-slate-200'}`} />
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-0.5">
                      <span className={hasMinLength ? 'text-emerald-600 font-medium' : ''}>• 8+ characters</span>
                      <span className={hasLetter ? 'text-emerald-600 font-medium' : ''}>• 1 letter</span>
                      <span className={hasNumber ? 'text-emerald-600 font-medium' : ''}>• 1 number</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full pl-10 pr-10 py-2.5 bg-white border rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition ${
                      confirmPassword && !passwordsMatch 
                        ? 'border-rose-300 focus:ring-2 focus:ring-rose-200' 
                        : confirmPassword && passwordsMatch 
                        ? 'border-emerald-300 focus:ring-2 focus:ring-emerald-200' 
                        : 'border-slate-200 focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15'
                    }`}
                  />
                  {confirmPassword && passwordsMatch && (
                    <CheckCircle2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="agreeTerms"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0088cc] border-slate-300 focus:ring-[#0088cc] cursor-pointer"
                />
                <label htmlFor="agreeTerms" className="text-[11px] text-slate-500 cursor-pointer select-none">
                  I agree to the <span className="text-[#0088cc] hover:underline font-medium">Terms of Service</span> and <span className="text-[#0088cc] hover:underline font-medium">Privacy Policy</span>.
                </label>
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
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Workspace Account</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              {/* Mobile Back Link */}
              <div className="text-center pt-2">
                <p className="text-xs text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={onBackToLogin}
                    className="font-semibold text-[#0088cc] hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Form Footer */}
        <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <span>Kevalon Technology HRMS & Enterprise Suite</span>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-600 transition cursor-pointer">Security</span>
            <span className="hover:text-slate-600 transition cursor-pointer">Privacy</span>
            <span className="hover:text-slate-600 transition cursor-pointer">Support</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterView;
