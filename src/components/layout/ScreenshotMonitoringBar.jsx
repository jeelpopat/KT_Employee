import React from 'react';
import { Camera, PauseCircle, PlayCircle, StopCircle, Eye, AlertCircle, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

export const ScreenshotMonitoringBar = () => {
  const { 
    attendanceStatus, 
    screenshotConfig, 
    nextScreenshotCountdown, 
    latestScreenshot, 
    screenshots,
    workSeconds,
    setIsScreenshotModalOpen
  } = useApp();

  const hrs = Math.floor(workSeconds / 3600);
  const mins = Math.floor((workSeconds % 3600) / 60);

  const getStatusBadge = () => {
    if (attendanceStatus === 'checked_in') {
      return (
        <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>🟢 Work Session Active — Screen Monitoring Active</span>
        </span>
      );
    }
    if (attendanceStatus === 'on_break') {
      return (
        <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-xs font-semibold">
          <PauseCircle size={14} className="text-amber-500" />
          <span>⏸️ On Break — Screen Monitoring Paused</span>
        </span>
      );
    }
    return (
      <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-600 border border-slate-500/20 text-xs font-semibold">
        <StopCircle size={14} className="text-slate-400" />
        <span>🔴 Session Inactive — Monitoring Stopped</span>
      </span>
    );
  };

  return (
    <div className="bg-slate-900 text-slate-200 border-b border-slate-800 px-4 py-2.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        
        {/* Left: Status & Transparent Notice */}
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-slate-800 rounded-lg text-blue-400">
            <Shield size={16} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {getStatusBadge()}
            <span className="text-[11px] text-slate-400 hidden lg:inline">
              Company Policy Compliant (Interval: Every {screenshotConfig.intervalSeconds}s)
            </span>
          </div>
        </div>

        {/* Right: Metrics & Actions */}
        <div className="flex items-center space-x-4 sm:space-x-6 text-slate-300">
          
          {/* Next Shot Countdown */}
          {attendanceStatus === 'checked_in' && (
            <div className="flex items-center space-x-1.5 font-mono text-slate-300 bg-slate-800 px-2.5 py-1 rounded-md">
              <Camera size={13} className="text-emerald-400 animate-spin" />
              <span>Capture in: <strong className="text-white">{nextScreenshotCountdown}s</strong></span>
            </div>
          )}

          {/* Last Shot Time */}
          <div className="hidden sm:flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase">Last Shot</span>
            <span className="font-semibold text-slate-200">{latestScreenshot ? latestScreenshot.captureTime : 'N/A'}</span>
          </div>

          {/* Total Captured Today */}
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase">Captured Today</span>
            <span className="font-semibold text-blue-400">{screenshots.length} Shots</span>
          </div>

          {/* Session Duration */}
          <div className="hidden md:flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase">Duration</span>
            <span className="font-semibold text-slate-200">{hrs}h {mins}m</span>
          </div>

          {/* Action Trigger */}
          <button
            onClick={() => setIsScreenshotModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium text-xs shadow-xs transition"
          >
            <Eye size={14} />
            <span>Read-Only History</span>
          </button>
        </div>

      </div>
    </div>
  );
};
