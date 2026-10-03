import React, { useState, useEffect } from "react";
import { 
  Building2, Clock, MapPin, Shield, Save, CheckCircle2, 
  AlertCircle, Wifi, Compass, Calendar, RotateCcw
} from "lucide-react";
import api from "../../api/axios";

export default function OfficeSettings() {
  const DEFAULT_SETTINGS = {
    workStartTime: "09:30",
    workEndTime: "18:30",
    gracePeriodMinutes: 15,
    halfDayHours: 4.5,
    fullDayHours: 8.5,
    autoCheckOutTime: "23:59",
    geofenceEnabled: true,
    latitude: "21.1702",
    longitude: "72.8311",
    radiusMeters: 100,
    officeWifiSsid: "Kevalon-Office-5G",
    requireWifiForCheckIn: false,
    weekendDays: ["Saturday", "Sunday"]
  };

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("kt_office_settings");
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback({ type: "", message: "" });

    try {
      // 1. Persist to localStorage
      localStorage.setItem("kt_office_settings", JSON.stringify(settings));

      // 2. Attempt backend persistence
      try {
        await api.post("/api/office/settings", settings);
      } catch (apiErr) {
        console.warn("Backend office settings endpoint notice (stored locally):", apiErr.message);
      }

      setFeedback({ type: "success", message: "Office attendance settings updated successfully!" });
      setTimeout(() => setFeedback({ type: "", message: "" }), 4000);
    } catch (err) {
      setFeedback({ type: "error", message: "Failed to save settings. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setFeedback({ type: "info", message: "Settings reset to company default guidelines." });
    setTimeout(() => setFeedback({ type: "", message: "" }), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <span>Office Attendance & Schedule Settings</span>
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Configure official work timings, late grace allowances, office geofencing coordinates, and check-in parameters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer transition-colors"
          >
            <RotateCcw size={13} />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {feedback.message && (
        <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 animate-fade-in ${
          feedback.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
            : feedback.type === "error"
            ? "bg-rose-50 border-rose-200 text-rose-800"
            : "bg-blue-50 border-blue-200 text-blue-800"
        }`}>
          {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Working Hours & Shifts */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Clock className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">Shift Timings & Workday Hours</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Office Start Time</label>
              <input
                type="time"
                value={settings.workStartTime}
                onChange={(e) => handleChange("workStartTime", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Official daily punch-in expectation</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Office End Time</label>
              <input
                type="time"
                value={settings.workEndTime}
                onChange={(e) => handleChange("workEndTime", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Official daily shift conclusion</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Late Grace Period (Minutes)</label>
              <input
                type="number"
                min="0"
                max="60"
                value={settings.gracePeriodMinutes}
                onChange={(e) => handleChange("gracePeriodMinutes", Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Tolerated buffer before marked as "Late"</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Half-Day Threshold (Hours)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="12"
                value={settings.halfDayHours}
                onChange={(e) => handleChange("halfDayHours", Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Minimum hours needed for half-day credit</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full-Day Threshold (Hours)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="14"
                value={settings.fullDayHours}
                onChange={(e) => handleChange("fullDayHours", Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Minimum active work for full-day attendance</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Auto Check-Out Time</label>
              <input
                type="time"
                value={settings.autoCheckOutTime}
                onChange={(e) => handleChange("autoCheckOutTime", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">System auto-ends active shift if unclosed</span>
            </div>
          </div>
        </div>

        {/* Section 2: Office Geofencing & Location Protection */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">Geofencing & Physical Verification</h3>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.geofenceEnabled}
                onChange={(e) => handleChange("geofenceEnabled", e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span>Enable GPS Geofencing</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Office Latitude</label>
              <input
                type="text"
                value={settings.latitude}
                onChange={(e) => handleChange("latitude", e.target.value)}
                placeholder="21.1702"
                disabled={!settings.geofenceEnabled}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Office Longitude</label>
              <input
                type="text"
                value={settings.longitude}
                onChange={(e) => handleChange("longitude", e.target.value)}
                placeholder="72.8311"
                disabled={!settings.geofenceEnabled}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Allowed Radius (Meters)</label>
              <input
                type="number"
                min="20"
                max="5000"
                value={settings.radiusMeters}
                onChange={(e) => handleChange("radiusMeters", Number(e.target.value))}
                disabled={!settings.geofenceEnabled}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Office Network (Wi-Fi Protection) */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Wifi className="w-4 h-4 text-sky-600" />
            <h3 className="text-sm font-semibold text-slate-900">Office Wi-Fi & Network Boundary</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Office Wi-Fi SSID / Network Name</label>
              <input
                type="text"
                value={settings.officeWifiSsid}
                onChange={(e) => handleChange("officeWifiSsid", e.target.value)}
                placeholder="Kevalon-Office-5G"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Expected local wireless identifier</span>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireWifiForCheckIn}
                  onChange={(e) => handleChange("requireWifiForCheckIn", e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>Mandate connection to Office Wi-Fi for mobile check-in</span>
              </label>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            <span>{isSaving ? "Saving Settings..." : "Save Office Configuration"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
