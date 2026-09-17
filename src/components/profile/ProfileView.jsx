import React, { useState, useEffect } from 'react';
import { 
  Shield, Save, CheckCircle2, User, 
  Mail, Phone, Briefcase, Calendar, 
  HeartPulse, MapPin, GraduationCap, 
  Code, Users, Loader2, Lock, KeyRound
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import api from '../../api/axios.js'; 

export const ProfileView = () => {
  const { user: contextUser, updateUserProfile } = useApp();
  
  const [profileData, setProfileData] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Form States - Contact
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  // Form States - Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  // Fetch Live Data on Mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/api/users/profile'); 
        const data = response.data?.data || response.data;
        setProfileData(data);

        const emp = data?.employee || {};
        const prof = data?.profile || data || {};

        setPhone(emp.mobile || prof.phoneNumber || '');
        setEmail(emp.email || prof.email || '');
        setAddress(emp.currentAddress || prof.address || '');

      } catch (error) {
        console.error("Error fetching profile:", error);
        setProfileData({ profile: contextUser });
        setPhone(contextUser?.phone || '');
        setEmail(contextUser?.email || '');
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchProfile();
  }, [contextUser]);

  const handleSaveContact = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await api.put('/api/users/profile/update', { 
        phoneNumber: phone, 
        mobile: phone,
        email, 
        address,
        currentAddress: address
      });

      if (updateUserProfile) {
        updateUserProfile({ phone, email, address });
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert("Failed to update profile details.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    setIsPasswordSaving(true);
    try {
      await api.put('/api/users/change-password', {
        newPassword
      });
      setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg({ type: '', text: '' }), 4000);
    } catch (error) {
      const errorText = error.response?.data?.message || error.response?.data?.error || 'Failed to change password.';
      setPasswordMsg({ type: 'error', text: errorText });
    } finally {
      setIsPasswordSaving(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-sm text-slate-500 font-medium">Loading your profile data...</p>
      </div>
    );
  }

  const emp = profileData?.employee || {};
  const prof = profileData?.profile || profileData || {};

  const fullName = emp.name || prof.name || contextUser?.name || 'Employee';
  const employeeId = emp.employeeID || prof.uniqueID || 'N/A';
  const designation = emp.designation || prof.designation || contextUser?.designation || 'N/A';
  const department = emp.department || prof.department || contextUser?.department || 'N/A';
  const joiningDateRaw = emp.joiningDate || prof.dob;
  const joiningDate = joiningDateRaw ? joiningDateRaw.split('T')[0] : 'N/A';
  const role = emp.role || prof.role || 'employee';
  
  const dobRaw = emp.dob || prof.dob;
  const dob = dobRaw ? dobRaw.split('T')[0] : 'N/A';
  const bloodGroup = emp.bloodGroup || prof.bloodGroup || 'N/A';
  const gender = emp.gender || 'N/A';

  const emergencyContact = emp.emergencyContact || {};
  const educationList = emp.education || [];
  const skillsList = emp.skills || [];

  // Helper to extract Name Initials (e.g. Meet Shah -> MS)
  const getInitials = (name) => {
    if (!name) return 'E';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Profile Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-6 flex flex-col md:flex-row items-center justify-between gap-6 transition-colors shadow-sm">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 w-full md:w-auto text-center md:text-left">
          
          {/* Dynamic Initials Avatar */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-md border border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-500 flex items-center justify-center text-3xl font-bold tracking-widest shadow-sm">
              {getInitials(fullName)}
            </div>
            <span className="absolute -bottom-2 -right-2 w-4 h-4 rounded-sm bg-green-500 border-2 border-white dark:border-slate-900" title="Online" />
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">{fullName}</h2>
              <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-400 font-mono text-xs font-bold uppercase tracking-wider">
                {employeeId}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-1.5">{designation}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span className="flex items-center gap-1.5"><Briefcase size={14} className="text-blue-500" /> {department}</span>
              <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" /> Joined {joiningDate}</span>
              <span className="flex items-center gap-1.5 capitalize"><Shield size={14} className="text-amber-500" /> Role: {role}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Read-Only Info & Skills */}
        <div className="space-y-6 lg:col-span-1">
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md transition-colors shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex items-center gap-2">
              <User size={16} className="text-slate-400" /> Identity Info
            </h3>
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Date of Birth</span>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100 font-mono">{dob}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Gender</span>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{gender}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Blood Group</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold font-mono border border-red-100 dark:border-red-800/50">
                  <HeartPulse size={12} /> {bloodGroup}
                </span>
              </div>
            </div>
          </div>

          {emergencyContact.name && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md transition-colors shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex items-center gap-2">
                <Users size={16} className="text-slate-400" /> Emergency Contact
              </h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block">{emergencyContact.name}</span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{emergencyContact.relation}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-medium bg-slate-50 dark:bg-slate-950 p-2.5 rounded-md border border-slate-100 dark:border-slate-800">
                  <Phone size={14} className="text-blue-500" /> {emergencyContact.phone}
                </div>
              </div>
            </div>
          )}

          {skillsList.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md transition-colors shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex items-center gap-2">
                <Code size={16} className="text-slate-400" /> Technical Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {skillsList.map((skill, i) => (
                  <span key={i} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Editable Forms & Security */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* Contact Details Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md transition-colors shadow-sm">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Contact Details</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Update your email, phone number, and physical address.</p>
            </div>

            <form onSubmit={handleSaveContact} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    <Mail size={14} className="text-slate-400" /> Email Address
                  </label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    <Phone size={14} className="text-slate-400" /> Phone Number
                  </label>
                  <input 
                    type="text" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    <MapPin size={14} className="text-slate-400" /> Current Address
                  </label>
                  <textarea 
                    value={address} 
                    onChange={e => setAddress(e.target.value)} 
                    rows={2}
                    className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-blue-500 transition-colors resize-y"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                {isSaved && (
                  <span className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50 rounded-md text-sm font-medium flex items-center gap-2 transition-opacity">
                    <CheckCircle2 size={16} /> Updated Successfully
                  </span>
                )}
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-70"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md transition-colors shadow-sm">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-950/50">
              <KeyRound size={18} className="text-slate-500 dark:text-slate-400" />
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Security & Password</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ensure your account is using a long, random password to stay secure.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordUpdate} className="p-6 space-y-6">
              {passwordMsg.text && (
                <div className={`p-3 rounded-md text-sm font-medium border ${passwordMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50' : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50'}`}>
                  {passwordMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Confirm New Password
                  </label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    required
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-6 border-t border-slate-200 dark:border-slate-800">
                <button 
                  type="submit" 
                  disabled={isPasswordSaving}
                  className="px-6 py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-md text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-70"
                >
                  {isPasswordSaving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                  {isPasswordSaving ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Education Records */}
          {educationList.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md transition-colors shadow-sm">
              <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-950/50">
                <GraduationCap size={18} className="text-slate-500 dark:text-slate-400" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Education History</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {educationList.map((edu, index) => (
                  <div key={index} className="p-4 border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-950 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{edu.degree}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{edu.institute}</p>
                    </div>
                    <div className="flex items-center justify-between mt-4 text-xs font-medium">
                      <span className="px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-mono">Class of {edu.passingYear}</span>
                      <span className="text-green-600 dark:text-green-500 font-bold">{edu.percentage}% Score</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
      
    </div>
  );
};