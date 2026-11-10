import React, { useState } from 'react';
import { 
  User, Mail, Phone, Shield, Calendar, Briefcase, MapPin, Activity,
  CheckCircle2, AlertCircle, ArrowRight, Sparkles 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { clearApiCache } from '../../api/axios.js';
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

export const RegisterView = ({ onBackToLogin, onRegisterSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('employee');
  const [dob, setDob] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [customDesignation, setCustomDesignation] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Full Name is required.');
      return;
    }

    if (!email.trim()) {
      setError('Official Email Address is required.');
      return;
    }

    if (!department) {
      setError('Please select a Department.');
      return;
    }

    if (!designation) {
      setError('Please select a Designation.');
      return;
    }

    if (designation === 'Other' && !customDesignation.trim()) {
      setError('Please specify your custom Designation in the text area.');
      return;
    }

    if (!gender) {
      setError('Please select your Gender.');
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

      const finalDesignation = designation === 'Other'
        ? customDesignation.trim()
        : designation.trim();

      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: formattedPhone || undefined,
        phoneNumber: formattedPhone || undefined,
        role: role.toLowerCase(),
        dob: dob || undefined,
        bloodGroup: bloodGroup || undefined,
        gender: gender || undefined,
        address: address.trim() || undefined,
        department: department || undefined,
        designation: finalDesignation || undefined,
        // Backend API schema fallback: include default secure temporary password
        password: 'Kevalon@' + new Date().getFullYear()
      };

      // Try /api/auth/register first, fallback to /api/users/register
      try {
        await api.post('/api/users/register', payload);
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
      if (onRegisterSuccess) {
        onRegisterSuccess(payload);
      }
      if (onBackToLogin) {
        onBackToLogin();
      } else {
        setSuccess(true);
      }
      showToast('Registration successful. Please sign in to continue.', 'success');
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
        className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-between p-10 xl:p-14 text-white relative overflow-hidden shrink-0"
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

        <div className="max-w-xl w-full mx-auto my-auto py-2">
          
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
              Enter your official employee profile details to register on Kevalon HRMS.
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
                  Your workspace account has been created for <span className="font-semibold text-slate-700">{email}</span>. You can now sign in to your workspace.
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
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition"
                  />
                </div>
              </div>

              {/* Row 2: Work Email */}
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

              {/* Row 3: Phone & Role (Grid) */}
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
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
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
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
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
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
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
                      value={department}
                      required
                      onChange={(e) => {
                        const newDept = e.target.value;
                        setDepartment(newDept);
                        const rolesInDept = EMPLOYEE_DEPARTMENTS_ROLES[newDept] || [];
                        if (!rolesInDept.includes(designation) && designation !== 'Other') {
                          setDesignation('');
                          setCustomDesignation('');
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
                      value={designation}
                      required
                      disabled={!department}
                      onChange={(e) => {
                        setDesignation(e.target.value);
                        if (e.target.value !== 'Other') {
                          setCustomDesignation('');
                        }
                      }}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition cursor-pointer disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">
                        {department ? 'Select Designation' : 'Select Department First'}
                      </option>
                      {department && EMPLOYEE_DEPARTMENTS_ROLES[department]?.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                      {department && (
                        <option value="Other">Other (Specify Custom Role)</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 6: Custom Designation Textarea (When "Other" is selected) */}
              {designation === 'Other' && (
                <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-100 animate-fade-in space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#0088cc]">
                      Specify Custom Designation / Role <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400">Department: {department}</span>
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={customDesignation}
                    onChange={(e) => setCustomDesignation(e.target.value)}
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
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Residential address / communication address..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/15 transition resize-none"
                  />
                </div>
              </div>

              {/* Row 8: Terms & Conditions Checkbox */}
              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="agreeTerms"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
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

              {/* Mobile Back Link */}
              <div className="text-center pt-1">
                <p className="text-xs text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={onBackToLogin}
                    className="font-semibold text-[#0088cc] hover:underline cursor-pointer ml-1"
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
            <Link to="/security-policy" className="transition hover:text-slate-600">Security</Link>
            <Link to="/privacy" className="transition hover:text-slate-600">Privacy</Link>
            <Link to="/support" className="transition hover:text-slate-600">Support</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterView;
