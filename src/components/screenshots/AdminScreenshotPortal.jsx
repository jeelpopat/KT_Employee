import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShieldCheck, Search, Clock, User, Play, Pause, HardDrive, Sliders,
  CheckCircle2, AlertTriangle, PlayCircle, StopCircle, RefreshCw, Settings,
  ExternalLink, Download, Copy, Check, Camera, Filter, Calendar, X,
  ChevronRight, Sparkles, Database, Layers, Eye
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { 
  getMonitoringSettings, 
  updateMonitoringSettings, 
  getAdminScreenshots,
  deriveEmployeePosition,
  extractEmployeeDetails,
  CLOUDINARY_CONFIG 
} from '../../services/monitoringService.js';

export const AdminScreenshotPortal = () => {
  const { 
    user,
    screenshots: contextScreenshots, 
    screenshotConfig, 
    setScreenshotConfig,
    attendanceStatus,
    checkInTime,
    checkOutTime,
    workSeconds,
    latestScreenshot,
    inactivityEvents,
    userRole,
    isScreenSharingActive,
    startScreenCapture,
    stopScreenCapture,
    captureRealScreenNow
  } = useApp();

  // State
  const [remoteScreenshots, setRemoteScreenshots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCapturingNow, setIsCapturingNow] = useState(false);
  const [screenCaptureError, setScreenCaptureError] = useState('');
  const [screenCaptureSuccess, setScreenCaptureSuccess] = useState('');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxRecord, setLightboxRecord] = useState(null);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState(false);
  const [copiedAttendanceId, setCopiedAttendanceId] = useState(false);

  // Status pill badge helper for Mongoose Session Schema status
  const renderStatusPill = (status) => {
    const s = String(status || 'active').toLowerCase().trim();
    if (s === 'break') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Break
        </span>
      );
    }
    if (s === 'auto_checkout') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          Auto Checkout
        </span>
      );
    }
    if (s === 'terminated') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          Terminated
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Active
      </span>
    );
  };

  // Helper to extract authentic employee name, ID, and designation
  const getRecordEmployeeInfo = (rec) => {
    if (!rec) return { name: 'Employee', id: 'EMP', designation: 'Staff' };

    const isValidName = (n) => n && typeof n === 'string' && n.trim().length > 0 && n.trim().toLowerCase() !== 'active employee' && n.trim().toLowerCase() !== 'employee' && n.trim().toLowerCase() !== 'user';

    // 1. Check direct name or employee object on rec
    let name = '';
    if (isValidName(rec.employeeName)) {
      name = rec.employeeName.trim();
    } else {
      const extracted = extractEmployeeDetails(rec);
      if (isValidName(extracted.name)) {
        name = extracted.name;
      }
    }

    // 2. If name is still missing or generic, resolve from active logged-in user or localStorage
    if (!isValidName(name)) {
      const activeStored = (() => {
        try {
          const str = localStorage.getItem('auth_user');
          return str ? JSON.parse(str) : null;
        } catch (e) { return null; }
      })();
      const activeUser = user || activeStored;
      const activeDetails = extractEmployeeDetails(activeUser);
      if (isValidName(activeDetails.name)) {
        name = activeDetails.name;
      }
    }

    // Resolve Clean ID
    let id = rec.employeeId;
    if (!id || id === 'EMP-8492' || id === 'EMP') {
      const activeStored = (() => {
        try {
          const str = localStorage.getItem('auth_user');
          return str ? JSON.parse(str) : null;
        } catch (e) { return null; }
      })();
      const activeUser = user || activeStored;
      const activeDetails = extractEmployeeDetails(activeUser);
      id = rec.userId || activeDetails.employeeId || activeUser?.employeeId || activeUser?._id || 'EMP';
    }

    // Resolve Clean Designation
    let designation = rec.designation;
    if (!designation || designation === 'Team Member' || designation === 'Staff') {
      const activeStored = (() => {
        try {
          const str = localStorage.getItem('auth_user');
          return str ? JSON.parse(str) : null;
        } catch (e) { return null; }
      })();
      const activeUser = user || activeStored;
      const activeDetails = extractEmployeeDetails(activeUser);
      designation = activeDetails.designation || rec.designation || 'Team Member';
    }

    return {
      name: name || 'Employee',
      id: id || 'EMP',
      designation: designation || 'Staff'
    };
  };

  // Helper to extract employee position (EMP, TL, HR, ADMIN, INTERN)
  const getRecordPosition = (rec) => {
    if (!rec) return { short: 'EMP', label: 'Employee' };

    const empInfo = getRecordEmployeeInfo(rec);
    const nameStr = (empInfo.name || rec.employeeName || '').toLowerCase();

    const emailStr = String(
      rec.email ||
      rec.userEmail ||
      rec.employee?.email ||
      rec.employeeId?.email ||
      user?.email ||
      ''
    ).toLowerCase();

    const idStr = String(
      rec.userId ||
      rec.employeeId ||
      empInfo.id ||
      rec._id ||
      rec.id ||
      rec.employee?._id ||
      rec.employee?.id ||
      rec.employeeId?._id ||
      ''
    ).toLowerCase();

    // 1. Hetvi or other known TLs are strictly Team Leader (TL)
    if (
      nameStr.includes('hetvi') ||
      emailStr.includes('hetvi') ||
      nameStr.includes('kuresh') ||
      emailStr.includes('kuresh') ||
      idStr.includes('6ab3894c4b9bcbcfe8afc6c')
    ) {
      return { short: 'TL', label: 'Team Leader', code: 'team_leader' };
    }

    // 2. If this screenshot belongs to active logged in user
    if (user && (
      rec.employeeId === user.employeeId ||
      rec.employeeId === user.id ||
      rec.employeeId === user._id ||
      rec.userId === user._id ||
      rec.userId === user.id ||
      (nameStr && nameStr === String(user.name || user.fullName || '').toLowerCase())
    )) {
      if (userRole === 'team_leader' || user.isTeamLeader) {
        return { short: 'TL', label: 'Team Leader', code: 'team_leader' };
      }
      if (userRole === 'admin') return { short: 'ADMIN', label: 'Administrator', code: 'admin' };
      if (userRole === 'hr') return { short: 'HR', label: 'HR Manager', code: 'hr' };
      if (userRole === 'intern') return { short: 'INTERN', label: 'Intern', code: 'intern' };
    }

    // 3. Team leader flags and role strings
    const isTL =
      rec.isTeamLeader === true ||
      rec.isTeamLead === true ||
      rec.employee?.isTeamLeader === true ||
      rec.employeeId?.isTeamLeader === true ||
      rec.userRole === 'team_leader' ||
      rec.userRole === 'team lead' ||
      rec.role === 'team_leader' ||
      rec.role === 'team lead' ||
      rec.positionShort === 'TL' ||
      rec.position === 'TL';

    if (isTL) {
      return { short: 'TL', label: 'Team Leader', code: 'team_leader' };
    }

    // 4. If explicit non-EMP position was specified in the record
    if (rec.positionShort && rec.positionShort !== 'EMP' && rec.positionLabel) {
      return { short: rec.positionShort, label: rec.positionLabel };
    }

    return deriveEmployeePosition(rec, rec.employee || rec.employeeId);
  };

  // Real Screen Capture Actions
  const handleCaptureRealScreenNow = async () => {
    setIsCapturingNow(true);
    setScreenCaptureError('');
    setScreenCaptureSuccess('');
    try {
      const result = await captureRealScreenNow();
      if (result) {
        setScreenCaptureSuccess(`Real device screen frame #${result.sequenceNo || '1'} captured & uploaded to Cloudinary successfully!`);
        setTimeout(() => setScreenCaptureSuccess(''), 4500);
      } else {
        setScreenCaptureError('Screen capture could not be completed. Please ensure screen share permission is allowed.');
      }
    } catch (err) {
      setScreenCaptureError(err.message || 'Failed to capture real device screen.');
    } finally {
      setIsCapturingNow(false);
    }
  };

  const handleToggleScreenShare = async () => {
    setScreenCaptureError('');
    setScreenCaptureSuccess('');
    if (isScreenSharingActive) {
      stopScreenCapture();
      setScreenCaptureSuccess('Device screen capture stopped.');
      setTimeout(() => setScreenCaptureSuccess(''), 3000);
    } else {
      try {
        await startScreenCapture();
        setScreenCaptureSuccess('Live device screen monitoring connected! Real workstation frames will be captured automatically.');
        setTimeout(() => setScreenCaptureSuccess(''), 4500);
      } catch (err) {
        setScreenCaptureError(err.message || 'Screen sharing was cancelled or denied.');
      }
    }
  };

  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState('');
  const [settingsErrorMsg, setSettingsErrorMsg] = useState('');
  const [settingsForm, setSettingsForm] = useState({
    intervalSeconds: 300,
    intervalMinutes: 5,
    isEnabled: true,
    pauseOnBreak: true,
    retentionDays: 30
  });

  // 1. Fetch remote screenshots from GET /api/employee-panel/monitoring/admin/screenshots
  const fetchScreenshots = useCallback(async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setIsRefreshing(true);
    try {
      const data = await getAdminScreenshots();
      if (Array.isArray(data) && data.length > 0) {
        setRemoteScreenshots(data);
      }
    } catch (err) {
      console.warn('Error fetching admin screenshots:', err);
    } finally {
      setIsLoading(false);
      if (showRefreshSpinner) setIsRefreshing(false);
    }
  }, []);

  // 2. Fetch monitoring settings from GET /api/employee-panel/monitoring/settings
  const fetchSettings = useCallback(async () => {
    try {
      const s = await getMonitoringSettings();
      if (s) {
        setSettingsForm({
          intervalSeconds: Number(s.intervalSeconds) || 300,
          intervalMinutes: Number(s.intervalMinutes) || Math.max(1, Math.round((Number(s.intervalSeconds) || 300) / 60)),
          isEnabled: s.isEnabled !== false,
          pauseOnBreak: s.pauseOnBreak !== false,
          retentionDays: Number(s.retentionDays) || 30
        });
      }
    } catch (err) {
      console.warn('Error fetching monitoring settings:', err);
    }
  }, []);

  useEffect(() => {
    fetchScreenshots();
    fetchSettings();
  }, [fetchScreenshots, fetchSettings]);

  // Combined screenshots: prioritize live active context captures + remote backend shots
  const allScreenshots = useMemo(() => {
    const map = new Map();
    // Prepend context screenshots (newest first)
    (contextScreenshots || []).forEach(s => {
      if (s && s.id) map.set(s.id, s);
    });
    // Add remote screenshots from backend
    (remoteScreenshots || []).forEach(s => {
      if (s && s.id && !map.has(s.id)) {
        map.set(s.id, s);
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.capturedAt || a.date).getTime() || 0;
      const timeB = new Date(b.capturedAt || b.date).getTime() || 0;
      return timeB - timeA;
    });
  }, [contextScreenshots, remoteScreenshots]);

  // Unique employees list for filter dropdown
  const uniqueEmployees = useMemo(() => {
    const list = new Map();
    allScreenshots.forEach(s => {
      const empInfo = getRecordEmployeeInfo(s);
      const empKey = empInfo.id || s.employeeId || s.userId;
      if (!empKey) return;
      const pos = getRecordPosition(s);
      const isNamed = empInfo.name && empInfo.name !== 'Active Employee' && empInfo.name !== 'Employee';
      const existing = list.get(empKey);
      if (!existing) {
        list.set(empKey, {
          id: empKey,
          name: isNamed ? empInfo.name : empKey,
          positionShort: pos.short,
          isNamed
        });
      } else {
        if (!existing.isNamed && isNamed) {
          existing.name = empInfo.name;
          existing.isNamed = true;
        }
        if (pos.short === 'TL' && existing.positionShort !== 'TL') {
          existing.positionShort = 'TL';
        }
      }
    });
    return Array.from(list.values());
  }, [allScreenshots, user]);

  // Filtered Screenshots
  const filteredScreenshots = useMemo(() => {
    return allScreenshots.filter(s => {
      const empInfo = getRecordEmployeeInfo(s);
      const matchesEmp = selectedEmployeeFilter === 'all' || s.employeeId === selectedEmployeeFilter || empInfo.id === selectedEmployeeFilter;
      const matchesDate = !selectedDateFilter || (s.date && s.date.startsWith(selectedDateFilter));
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (empInfo.name && empInfo.name.toLowerCase().includes(q)) ||
        (s.employeeName && s.employeeName.toLowerCase().includes(q)) ||
        (empInfo.id && empInfo.id.toLowerCase().includes(q)) ||
        (s.employeeId && s.employeeId.toLowerCase().includes(q)) ||
        (s.activeWindow && s.activeWindow.toLowerCase().includes(q));
      return matchesEmp && matchesDate && matchesSearch;
    });
  }, [allScreenshots, selectedEmployeeFilter, selectedDateFilter, searchQuery]);

  // Auto-play slideshow ticker
  useEffect(() => {
    if (!isPlayingTimeline || filteredScreenshots.length === 0) return;
    const timer = setInterval(() => {
      setTimelineIndex(prev => {
        const nextIdx = (prev + 1) % filteredScreenshots.length;
        setLightboxRecord(filteredScreenshots[nextIdx]);
        return nextIdx;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [isPlayingTimeline, filteredScreenshots]);

  // Handle Save Settings via POST /api/employee-panel/monitoring/settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSuccessMsg('');
    setSettingsErrorMsg('');

    try {
      const sec = Number(settingsForm.intervalMinutes) * 60;
      const payload = {
        intervalSeconds: sec,
        intervalMinutes: Number(settingsForm.intervalMinutes),
        isEnabled: settingsForm.isEnabled,
        pauseOnBreak: settingsForm.pauseOnBreak,
        retentionDays: Number(settingsForm.retentionDays) || 30
      };

      const updated = await updateMonitoringSettings(payload);
      if (updated) {
        setScreenshotConfig(prev => ({
          ...prev,
          intervalSeconds: sec,
          intervalMinutes: Number(settingsForm.intervalMinutes),
          isEnabled: settingsForm.isEnabled,
          pauseOnBreak: settingsForm.pauseOnBreak,
          retentionDays: Number(settingsForm.retentionDays) || 30
        }));
        setSettingsSuccessMsg('Monitoring settings updated successfully.');
        setTimeout(() => {
          setIsSettingsModalOpen(false);
          setSettingsSuccessMsg('');
        }, 1200);
      }
    } catch (err) {
      console.error('Error saving monitoring settings:', err);
      setSettingsErrorMsg('Failed to update settings. Please try again.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const hrs = Math.floor(workSeconds / 3600);
  const mins = Math.floor((workSeconds % 3600) / 60);
  const earliestShotTime = allScreenshots[allScreenshots.length - 1]?.captureTime || checkInTime;
  const latestShotTime = latestScreenshot ? latestScreenshot.captureTime : (allScreenshots[0]?.captureTime || 'N/A');

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 dark:bg-black text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-colors">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold border border-blue-500/30 flex items-center gap-1.5">
              <ShieldCheck size={13} />
              HR & Admin Monitoring Portal
            </span>
            <a 
              href="https://console.cloudinary.com"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-400 hover:text-emerald-400 font-mono flex items-center gap-1 transition"
              title="Open console.cloudinary.com Media Library"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Cloudinary Vault Connected ({CLOUDINARY_CONFIG.cloudName})</span>
              <ExternalLink size={11} className="ml-0.5 text-slate-500" />
            </a>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">Work Activity & Screenshot Monitoring</h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Silent background activity monitoring for employee workstations. Every frame is securely captured and archived in Cloudinary storage. Inspect frames, customize intervals, and review inactivity logs.
          </p>
        </div>

        {/* Action Controls: Screen Capture + Refresh + Settings Trigger */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Toggle Screen Share Button */}
          <button
            onClick={handleToggleScreenShare}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer border ${
              isScreenSharingActive
                ? 'bg-emerald-950/80 border-emerald-500/50 hover:bg-emerald-900 text-emerald-300'
                : 'bg-amber-500/20 border-amber-500/40 hover:bg-amber-500/30 text-amber-300'
            }`}
            title={isScreenSharingActive ? 'Device screen sharing is active' : 'Click to enable device screen sharing'}
          >
            <span className={`w-2 h-2 rounded-full ${isScreenSharingActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{isScreenSharingActive ? 'Screen Connected' : 'Share Screen'}</span>
          </button>

          {/* Instant Real Screen Capture Trigger */}
          <button
            onClick={handleCaptureRealScreenNow}
            disabled={isCapturingNow}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
            title="Capture real employee device screen right now and upload to Cloudinary"
          >
            <Camera size={14} className={isCapturingNow ? 'animate-pulse text-emerald-200' : ''} />
            <span>{isCapturingNow ? 'Capturing Frame...' : 'Capture Real Screen Now'}</span>
          </button>

          <button
            onClick={() => fetchScreenshots(true)}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition cursor-pointer disabled:opacity-50"
            title="Refresh Screenshot Feed"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-blue-400' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => {
              fetchSettings();
              setIsSettingsModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Screen Capture Feedback Banners */}
      {screenCaptureSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex items-center gap-2.5 text-emerald-400 text-xs font-medium animate-fadeIn">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{screenCaptureSuccess}</span>
        </div>
      )}

      {screenCaptureError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 flex items-center gap-2.5 text-rose-400 text-xs font-medium animate-fadeIn">
          <AlertTriangle size={16} className="text-rose-400 shrink-0" />
          <span>{screenCaptureError}</span>
        </div>
      )}

      {!isScreenSharingActive && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
              <Camera size={18} />
            </div>
            <div>
              <p className="font-semibold text-amber-200">Device Screen Monitoring Not Active</p>
              <p className="text-[11px] text-amber-400/80 mt-0.5">
                Grant desktop screen sharing permission so your browser captures actual device screen frames every 1 minute.
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleScreenShare}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shrink-0 shadow-sm"
          >
            Enable Device Screen Capture
          </button>
        </div>
      )}

      {/* Cloudinary Vault & Active Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Total Shots</span>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 block">
            {allScreenshots.length} Shots
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Archived & Live</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Interval</span>
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1 block">
            {screenshotConfig.intervalMinutes || Math.round(screenshotConfig.intervalSeconds / 60) || 5} Min
          </span>
          <span className="text-[10px] text-slate-500 font-mono">({screenshotConfig.intervalSeconds || 300}s auto-shot)</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Employees</span>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 block">
            {uniqueEmployees.length || 1} Monitored
          </span>
          <span className="text-[10px] text-slate-500">Across sessions</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Latest Capture</span>
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 block truncate">
            {latestShotTime}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Real-time sync</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Session Work</span>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 block">
            {hrs}h {mins}m
          </span>
          <span className="text-[10px] text-slate-500">Current shift</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Cloud Storage</span>
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 block truncate">
            Cloudinary
          </span>
          <span className="text-[10px] text-slate-500 font-mono truncate block" title={CLOUDINARY_CONFIG.cloudId}>
            ID: {CLOUDINARY_CONFIG.cloudId.slice(0, 10)}...
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 transition-colors">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Employee Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <User size={14} className="text-slate-400 shrink-0" />
            <select
              value={selectedEmployeeFilter}
              onChange={e => setSelectedEmployeeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none transition cursor-pointer"
            >
              <option value="all">All Employees ({allScreenshots.length})</option>
              {uniqueEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  [{emp.positionShort || 'EMP'}] {emp.name} ({emp.id})
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={selectedDateFilter}
              onChange={e => setSelectedDateFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none transition cursor-pointer"
            />
            {selectedDateFilter && (
              <button 
                onClick={() => setSelectedDateFilter('')}
                className="text-2xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee, ID, app window..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* Gallery Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        
        <div className="p-4 bg-slate-50/70 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Camera size={14} className="text-blue-500" />
              All Monitored Screenshots Feed
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Showing {filteredScreenshots.length} of {allScreenshots.length} frames archived in Cloudinary
            </p>
          </div>

          <button
            onClick={() => {
              if (!isPlayingTimeline && filteredScreenshots.length > 0) {
                setLightboxRecord(filteredScreenshots[0]);
                setTimelineIndex(0);
              }
              setIsPlayingTimeline(!isPlayingTimeline);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer ${
              isPlayingTimeline 
                ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                : 'bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white'
            }`}
          >
            {isPlayingTimeline ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlayingTimeline ? 'Pause Slideshow' : 'Chronological Auto-Play'}</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <RefreshCw size={24} className="animate-spin text-blue-500" />
            <span className="text-xs text-slate-500 font-medium">Loading screenshot archives...</span>
          </div>
        ) : filteredScreenshots.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <Camera size={36} className="mx-auto text-slate-400 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No screenshots match the criteria</p>
            <p className="text-xs text-slate-500">Screenshots will appear here automatically every minute during active work sessions.</p>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredScreenshots.map((scr, idx) => (
              <div 
                key={scr.id || idx}
                onClick={() => setLightboxRecord(scr)}
                className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group p-2.5 space-y-2"
              >
                <div className="relative rounded-lg overflow-hidden bg-slate-900 h-40">
                  <img 
                    src={scr.thumbnailUrl || scr.fullUrl} 
                    alt={scr.activeWindow} 
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='225' viewBox='0 0 400 225'><rect width='400' height='225' fill='%230f172a'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%2364748b' font-family='sans-serif' font-size='13'>Real Device Screen Frame</text></svg>";
                    }}
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 text-white text-[10px] font-mono font-semibold backdrop-blur-xs">
                    #{scr.sequenceNo || idx + 1}
                  </span>
                  <span className="absolute top-2 right-2 backdrop-blur-xs">
                    {renderStatusPill(scr.status)}
                  </span>
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-blue-600/90 text-white text-[10px] font-semibold backdrop-blur-xs">
                    {scr.activityLevel || 88}% Activity
                  </span>
                </div>

                {(() => {
                  const cardPos = getRecordPosition(scr);
                  const cardEmp = getRecordEmployeeInfo(scr);
                  return (
                    <div className="space-y-1">
                      {/* Employee Position above name */}
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide ${
                          cardPos.short === 'TL'
                            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            : cardPos.short === 'HR'
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : cardPos.short === 'ADMIN'
                            ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            : cardPos.short === 'INTERN'
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        }`}>
                          {cardPos.short} ({cardPos.label})
                        </span>
                        <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                          {cardEmp.id}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                        {cardEmp.name}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-normal" title={scr.activeWindow}>
                        {scr.activeWindow || 'Work Workspace'}
                      </p>
                      {scr.deviceInfo && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate" title={scr.deviceInfo}>
                          💻 {scr.deviceInfo}
                        </p>
                      )}
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-1.5 border-t border-slate-100 dark:border-slate-800">
                        <span>{scr.captureTime}</span>
                        <span>{scr.date}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Inactivity Events Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-4 transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Inactivity Event Log (HR Auditing)
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-medium">
            {inactivityEvents.length} Events Logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Start Time</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Session ID</th>
                <th className="py-3 px-4">Employee Response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {inactivityEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{evt.employeeName}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">{evt.employeeId}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">{evt.startTime}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50 font-medium">
                      {evt.duration}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">{evt.sessionId}</td>
                  <td className="py-3 px-4">
                    {evt.responseStatus === 'Acknowledged - Working' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-medium flex items-center space-x-1 w-fit">
                        <CheckCircle2 size={12} />
                        <span>Acknowledged - Working</span>
                      </span>
                    )}
                    {evt.responseStatus === 'Switched to Break' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-medium flex items-center space-x-1 w-fit">
                        <Pause size={12} />
                        <span>Switched to Break</span>
                      </span>
                    )}
                    {evt.responseStatus === 'Waiting for Employee Response' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-medium flex items-center space-x-1 w-fit">
                        <AlertTriangle size={12} />
                        <span>Waiting Response</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxRecord && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col lg:flex-row max-h-[92vh]">
            
            {/* Image Preview Canvas */}
            <div className="flex-1 bg-black p-4 flex items-center justify-center relative">
              <img 
                src={lightboxRecord.fullUrl || lightboxRecord.thumbnailUrl} 
                alt={lightboxRecord.activeWindow} 
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
              <span className="absolute top-4 left-4 bg-slate-900/80 text-white font-mono text-xs px-3 py-1 rounded-full border border-slate-700">
                Sequence #{lightboxRecord.sequenceNo}
              </span>
              <span className="absolute bottom-4 left-4 bg-emerald-600/90 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                <Database size={12} />
                Stored in Cloudinary ({CLOUDINARY_CONFIG.cloudName})
              </span>
            </div>

            {/* Right Meta Sidebar */}
            <div className="w-full lg:w-84 bg-slate-900 p-5 text-white border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Screenshot Metadata</h3>
                  <button 
                    onClick={() => {
                      setLightboxRecord(null);
                      setIsPlayingTimeline(false);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  {/* Session Status & Mongoose Schema Telemetry */}
                  <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1.5 tracking-wider">
                        <Database size={12} className="text-blue-400" />
                        Session Telemetry
                      </span>
                      {renderStatusPill(lightboxRecord.status)}
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      {/* userId (ObjectId ref User) */}
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block">User ID (ObjectId ref User)</span>
                        <div className="flex items-center justify-between mt-0.5 bg-slate-950/80 px-2 py-1 rounded border border-slate-800 font-mono">
                          <span className="text-emerald-400 text-[10px] truncate" title={lightboxRecord.userId}>
                            {lightboxRecord.userId || 'N/A'}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(lightboxRecord.userId || '');
                              setCopiedUserId(true);
                              setTimeout(() => setCopiedUserId(false), 2000);
                            }}
                            className="p-0.5 hover:text-white text-slate-400 cursor-pointer ml-1"
                            title="Copy User ObjectId"
                          >
                            {copiedUserId ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          </button>
                        </div>
                      </div>

                      {/* attendanceId (ObjectId ref Attendance) */}
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold block">Attendance ID (ObjectId ref Attendance)</span>
                        <div className="flex items-center justify-between mt-0.5 bg-slate-950/80 px-2 py-1 rounded border border-slate-800 font-mono">
                          <span className={`text-[10px] truncate ${lightboxRecord.attendanceId ? 'text-blue-400' : 'text-slate-500'}`} title={lightboxRecord.attendanceId || 'null'}>
                            {lightboxRecord.attendanceId || 'null (No Active Shift)'}
                          </span>
                          {lightboxRecord.attendanceId && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(lightboxRecord.attendanceId || '');
                                setCopiedAttendanceId(true);
                                setTimeout(() => setCopiedAttendanceId(false), 2000);
                              }}
                              className="p-0.5 hover:text-white text-slate-400 cursor-pointer ml-1"
                              title="Copy Attendance ObjectId"
                            >
                              {copiedAttendanceId ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* startTime & endTime */}
                      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        <div className="bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                          <span className="text-[9px] text-slate-400 uppercase block font-semibold">Start Time</span>
                          <span className="text-[10px] text-slate-200 block truncate font-mono">
                            {lightboxRecord.startTime ? new Date(lightboxRecord.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}
                          </span>
                        </div>
                        <div className="bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                          <span className="text-[9px] text-slate-400 uppercase block font-semibold">End Time</span>
                          <span className="text-[10px] text-slate-200 block truncate font-mono">
                            {lightboxRecord.endTime ? new Date(lightboxRecord.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'null (Active)'}
                          </span>
                        </div>
                      </div>

                      {/* lastActiveTime */}
                      <div className="bg-slate-950/80 px-2 py-1 rounded border border-slate-800 flex items-center justify-between">
                        <span className="text-[9px] text-slate-400 uppercase font-semibold">Last Active</span>
                        <span className="text-[10px] text-emerald-400 font-mono">
                          {lightboxRecord.lastActiveTime ? new Date(lightboxRecord.lastActiveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
                        </span>
                      </div>

                      {/* deviceInfo */}
                      <div className="bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                        <span className="text-[9px] text-slate-400 uppercase block font-semibold">Device Info</span>
                        <span className="text-[10px] text-slate-300 block font-mono truncate" title={lightboxRecord.deviceInfo}>
                          💻 {lightboxRecord.deviceInfo || 'Desktop Workstation'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Employee Position & Name */}
                  {(() => {
                    const pos = getRecordPosition(lightboxRecord);
                    const empInfo = getRecordEmployeeInfo(lightboxRecord);
                    return (
                      <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                            Position: <strong className="text-white font-mono">{pos.short}</strong>
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                            pos.short === 'TL'
                              ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40'
                              : pos.short === 'HR'
                              ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                              : pos.short === 'ADMIN'
                              ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                              : pos.short === 'INTERN'
                              ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                              : 'bg-blue-500/25 text-blue-300 border border-blue-500/40'
                          }`}>
                            {pos.short} ({pos.label})
                          </span>
                        </div>
                        <span className="text-sm font-bold text-white block">{empInfo.name}</span>
                        <span className="text-[10px] text-blue-400 font-mono mt-0.5 block">{empInfo.id} • {empInfo.designation}</span>
                      </div>
                    );
                  })()}

                  <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Timestamp & Session</span>
                    <span className="text-xs font-semibold text-slate-200 mt-0.5 block">{lightboxRecord.date} at {lightboxRecord.captureTime}</span>
                    <span className="text-[10px] text-slate-400 font-mono mt-1 block">{lightboxRecord.sessionId}</span>
                  </div>

                  <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Active Window</span>
                    <span className="text-xs font-semibold text-slate-200 mt-0.5 block break-all">{lightboxRecord.activeWindow}</span>
                  </div>

                  <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Activity Level</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-bold text-emerald-400 text-sm">{lightboxRecord.activityLevel}%</span>
                      <span className="text-[10px] text-slate-400">Mouse & Keyboard Active</span>
                    </div>
                  </div>

                  {/* Cloudinary Link Action */}
                  <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Cloudinary Asset</span>
                      <span className="text-[10px] text-slate-400 font-mono truncate block">{CLOUDINARY_CONFIG.cloudName}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(lightboxRecord.fullUrl)}
                      className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedUrl ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <a
                  href={lightboxRecord.fullUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink size={14} />
                  <span>Open Full High-Res Asset</span>
                </a>
                <a
                  href="https://console.cloudinary.com"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Database size={14} />
                  <span>Open in console.cloudinary.com</span>
                </a>
                <button
                  onClick={() => {
                    setLightboxRecord(null);
                    setIsPlayingTimeline(false);
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Settings Modal (Configures POST /api/employee-panel/monitoring/settings) */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Screenshot Monitoring Settings</h3>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="p-6 space-y-5 text-xs">
              
              {settingsSuccessMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800 font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{settingsSuccessMsg}</span>
                </div>
              )}

              {settingsErrorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800 font-semibold flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>{settingsErrorMsg}</span>
                </div>
              )}

              {/* Capture Interval */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Capture Frequency (Every N Minutes)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 5, 10].map((mins) => (
                    <button
                      type="button"
                      key={mins}
                      onClick={() => setSettingsForm(prev => ({ ...prev, intervalMinutes: mins, intervalSeconds: mins * 60 }))}
                      className={`py-2 px-3 rounded-xl border font-semibold transition cursor-pointer text-center ${
                        settingsForm.intervalMinutes === mins
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      {mins} Min {mins === 5 ? '(Default)' : ''}
                    </button>
                  ))}
                </div>
                <p className="text-2xs text-slate-500 mt-1.5">
                  Standard company policy captures an automated screenshot every 5 minutes during active employee work sessions. Monitoring is strictly paused during break time.
                </p>
              </div>

              {/* Switches */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block text-xs">Background Monitoring</span>
                    <span className="text-2xs text-slate-500">Enable automatic periodic capturing when employees are checked in</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsForm.isEnabled}
                    onChange={e => setSettingsForm(prev => ({ ...prev, isEnabled: e.target.checked }))}
                    className="accent-blue-600 w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block text-xs">Pause On Break</span>
                    <span className="text-2xs text-slate-500">Pause monitoring immediately whenever employee starts a break</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsForm.pauseOnBreak}
                    onChange={e => setSettingsForm(prev => ({ ...prev, pauseOnBreak: e.target.checked }))}
                    className="accent-blue-600 w-4 h-4 cursor-pointer"
                  />
                </label>
              </div>

              {/* Cloudinary Integration Status */}
              <div className="p-3.5 bg-slate-900 text-slate-200 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                    <Database size={12} className="text-emerald-400" />
                    Cloudinary Vault Configuration
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-2xs font-semibold">Active</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-2xs font-mono text-slate-400">
                  <div>Cloud Name: <strong className="text-white">{CLOUDINARY_CONFIG.cloudName}</strong></div>
                  <div>API Key: <strong className="text-white">{CLOUDINARY_CONFIG.apiKey.slice(0, 8)}...</strong></div>
                  <div className="col-span-2 truncate">Cloud ID: <strong className="text-white">{CLOUDINARY_CONFIG.cloudId}</strong></div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-2 cursor-pointer shadow-sm transition disabled:opacity-50"
                >
                  {isSavingSettings && <RefreshCw size={14} className="animate-spin" />}
                  <span>{isSavingSettings ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
