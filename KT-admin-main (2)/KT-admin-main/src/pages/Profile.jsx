import { useState, useEffect } from 'react';
import { 
  MapPin, 
  Phone, 
  Mail,
  User,
  Briefcase,
  ShieldCheck,
  Calendar,
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle,
  Save,
  Building2
} from 'lucide-react';

export default function Profile() {
  const [adminData, setAdminData] = useState({
    name: "Kevalon Technology Admin",
    email: "sales@kevalontechnology.in",
    sector: "Information Technology (IT)",
    role: "Administrator",
    status: "Active",
    joinedDate: "November 2023",
    location: "Ahmedabad, Gujarat",
    phone: ["+91 9081012218", "+91 9104012218"]
  });

  const [saving, setSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");

  // Change password state
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    try {
      const storedUser =
        localStorage.getItem("user") ||
        localStorage.getItem("currentUser") ||
        localStorage.getItem("loggedInUser");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        const resolvedName =
          user.name ||
          `${user.firstName || ""} ${user.lastName || ""}`.trim();
        setAdminData((prev) => ({
          ...prev,
          name: resolvedName || prev.name,
          email: user.email || prev.email,
          role: user.role
            ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
            : prev.role,
        }));
      }
    } catch (e) {
      console.error("Profile load error:", e);
    }
  }, []);

  const handleUpdate = (e) => {
    e.preventDefault();
    setSaving(true);
    setProfileSuccess("");
    
    setTimeout(() => {
      setSaving(false);
      setProfileSuccess("Account configurations updated successfully.");
      setTimeout(() => setProfileSuccess(""), 4000);
    }, 600);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!passwordData.oldPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }

    if (!passwordData.newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }

    try {
      setPasswordLoading(true);

      const token = localStorage.getItem("token");
      const storedUser =
        localStorage.getItem("user") ||
        localStorage.getItem("currentUser") ||
        localStorage.getItem("loggedInUser");

      let userEmail = adminData.email || "";
      let userId = "";
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          userEmail = parsed?.email || userEmail;
          userId =
            parsed?._id ||
            parsed?.id ||
            parsed?.user?._id ||
            parsed?.data?._id ||
            "";
        } catch (err) {
          console.error("Error parsing stored user:", err);
        }
      }

      const API_BASE =
        process.env.REACT_APP_API_BASE_URL ||
        (window.location.hostname === "localhost"
          ? "http://localhost:5000"
          : "https://kt-backend-1.onrender.com");

      // Change Password API for logged-in user
      const response = await fetch(`${API_BASE}/api/users/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: userId || undefined,
          oldPassword: passwordData.oldPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Failed to reset password.");
      }

      setPasswordSuccess(data.message || "Password reset successfully!");
      setPasswordData({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => setPasswordSuccess(""), 5000);
    } catch (err) {
      setPasswordError(
        err.message || "Something went wrong. Please try again."
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "AD";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Admin Profile</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              <ShieldCheck className="w-3.5 h-3.5" />
              Verified
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Manage your personal profile details, organization settings, and security credentials.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Segment: Visual Meta Badge Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs flex flex-col items-center text-center">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl mb-3 shadow-xs">
            {getInitials(adminData.name)}
          </div>
          
          <h3 className="text-base font-bold text-gray-900">{adminData.name}</h3>
          
          <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{adminData.role}</span>
          </div>
          
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              {adminData.sector}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {adminData.status}
            </span>
          </div>

          {/* Info List */}
          <div className="mt-6 pt-5 border-t border-gray-100 w-full text-xs text-gray-600 space-y-3 text-left">
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shadow-xs text-gray-600 border border-gray-200 flex-shrink-0">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Location</p>
                <p className="text-gray-800 font-semibold truncate">{adminData.location}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shadow-xs text-gray-600 border border-gray-200 flex-shrink-0 mt-0.5">
                <Phone className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Contact Numbers</p>
                <div className="space-y-0.5 mt-0.5">
                  {adminData.phone && adminData.phone.map((p) => (
                    <a 
                      key={p}
                      href={`tel:${p.replace(/\s+/g, '')}`} 
                      className="block text-gray-800 font-semibold hover:text-indigo-600 transition-colors"
                    >
                      {p}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shadow-xs text-gray-600 border border-gray-200 flex-shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Member Since</p>
                <p className="text-gray-800 font-semibold">{adminData.joinedDate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Segment: Editable Forms */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Account Configurations */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Account Configurations</h2>
                <p className="text-xs text-gray-500">Update company identity and public communication details.</p>
              </div>
            </div>
            
            <div className="p-6">
              {profileSuccess && (
                <div className="mb-5 flex items-center gap-2.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-3.5 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                      Display Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input 
                        type="text"
                        value={adminData.name}
                        onChange={(e) => setAdminData({ ...adminData, name: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-gray-800 shadow-xs focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                      Registered Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input 
                        type="email"
                        value={adminData.email}
                        onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-gray-800 shadow-xs focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                      Operating Sector
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <input 
                        type="text"
                        disabled
                        value={adminData.sector}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-gray-500 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                      Office Location Override
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <input 
                        type="text"
                        value={adminData.location}
                        onChange={(e) => setAdminData({ ...adminData, location: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-gray-800 shadow-xs focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-gray-100">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving Records...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Change Password Section */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-700">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Change Password</h2>
                  <p className="text-xs text-gray-500">Update and strengthen your account credentials.</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {passwordError && (
                <div className="mb-5 flex items-center gap-2.5 text-xs text-red-800 bg-red-50 border border-red-200 p-3.5 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="mb-5 flex items-center gap-2.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-3.5 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showOldPassword ? "text" : "password"}
                      placeholder="Enter current password"
                      value={passwordData.oldPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          oldPassword: e.target.value,
                        })
                      }
                      className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-10 py-2.5 text-sm text-gray-800 shadow-xs focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    >
                      {showOldPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter new password (min. 6 chars)"
                        value={passwordData.newPassword}
                        onChange={(e) =>
                          setPasswordData({
                            ...passwordData,
                            newPassword: e.target.value,
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-10 py-2.5 text-sm text-gray-800 shadow-xs focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter new password"
                        value={passwordData.confirmPassword}
                        onChange={(e) =>
                          setPasswordData({
                            ...passwordData,
                            confirmPassword: e.target.value,
                          })
                        }
                        className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-10 py-2.5 text-sm text-gray-800 shadow-xs focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Must be at least 6 characters.
                  </p>
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    {passwordLoading ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}