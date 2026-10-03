import React, { useState, useEffect } from "react";
import { 
  Settings as SettingsIcon, Shield, Bell, Moon, Sun, Monitor, 
  Save, CheckCircle2, AlertCircle, Building, Mail, Clock, Lock
} from "lucide-react";
import api from "../api/axios";

export default function Setting() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem("kt_system_settings");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      companyName: "Kevalon Technology",
      supportEmail: "support@kevalon.com",
      sessionTimeoutMinutes: 60,
      soundAlertEnabled: true,
      emailNotifications: true,
      requireSpecialCharInPassword: true,
      minPasswordLength: 6,
      portalNoticeBanner: ""
    };
  });

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    const root = document.documentElement;
    if (newTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback({ type: "", message: "" });

    try {
      localStorage.setItem("kt_system_settings", JSON.stringify(formData));
      setFeedback({ type: "success", message: "Application settings saved successfully!" });
      setTimeout(() => setFeedback({ type: "", message: "" }), 4000);
    } catch (err) {
      setFeedback({ type: "error", message: "Failed to save application settings." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200/80">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-indigo-600" />
          <span>System & Workspace Settings</span>
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Manage general organization information, portal security rules, notification triggers, and user interface preferences.
        </p>
      </div>

      {feedback.message && (
        <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 animate-fade-in ${
          feedback.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Appearance & Theme */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sun className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900">Interface Theme</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleThemeChange("light")}
              className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                theme === "light" 
                  ? "border-indigo-600 bg-indigo-50/40 text-indigo-900 ring-1 ring-indigo-600" 
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <Sun size={18} className={theme === "light" ? "text-indigo-600" : "text-slate-400"} />
                {theme === "light" && <span className="w-2 h-2 rounded-full bg-indigo-600"></span>}
              </div>
              <div>
                <p className="text-xs font-semibold">Light Mode</p>
                <p className="text-[10px] text-slate-500">Standard crisp bright theme</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange("dark")}
              className={`p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                theme === "dark" 
                  ? "border-indigo-600 bg-indigo-50/40 text-indigo-900 ring-1 ring-indigo-600" 
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <Moon size={18} className={theme === "dark" ? "text-indigo-600" : "text-slate-400"} />
                {theme === "dark" && <span className="w-2 h-2 rounded-full bg-indigo-600"></span>}
              </div>
              <div>
                <p className="text-xs font-semibold">Dark Mode</p>
                <p className="text-[10px] text-slate-500">Reduced eye strain in low light</p>
              </div>
            </button>
          </div>
        </div>

        {/* Section 2: General Organization */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">Organization Information</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Company Display Name</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => handleChange("companyName", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Support Contact Email</label>
              <input
                type="email"
                value={formData.supportEmail}
                onChange={(e) => handleChange("supportEmail", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Section 3: Security & Session Parameters */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Shield className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900">Security & Session Policies</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Idle Session Expiration (Minutes)</label>
              <input
                type="number"
                min="15"
                max="480"
                value={formData.sessionTimeoutMinutes}
                onChange={(e) => handleChange("sessionTimeoutMinutes", Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Automatic sign-out on prolonged inactivity</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Minimum Password Length</label>
              <input
                type="number"
                min="6"
                max="32"
                value={formData.minPasswordLength}
                onChange={(e) => handleChange("minPasswordLength", Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Enforced for employee password updates</span>
            </div>
          </div>
        </div>

        {/* Section 4: Notifications & Audio */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Bell className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">Notifications & Audio Alerts</h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.soundAlertEnabled}
                onChange={(e) => handleChange("soundAlertEnabled", e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span>Play audible chime when inactivity alarm triggers during working shifts</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.emailNotifications}
                onChange={(e) => handleChange("emailNotifications", e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span>Send automated email notifications for leave requests and check-in approvals</span>
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            <span>{isSaving ? "Saving..." : "Save Workspace Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
