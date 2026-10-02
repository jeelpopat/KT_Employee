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
    setIsScreenshotModalOpen,
    isScreenSharingActive,
    startScreenCapture,
    stopScreenCapture,
    captureRealScreenNow
  } = useApp();

  const hrs = Math.floor(workSeconds / 3600);
  const mins = Math.floor((workSeconds % 3600) / 60);

  const getStatusBadge = () => {
    if (attendanceStatus === 'checked_in') {
      if (isScreenSharingActive) {
        return (
          <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>🟢 Real Device Screen Monitoring Active</span>
          </span>
        );
      }
      return (
        <button
          onClick={() => startScreenCapture().catch(e => console.warn(e))}
          className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold cursor-pointer transition"
          title="Click to grant screen share permission for real device monitoring"
        >
          <Camera size={13} className="text-amber-400" />
          <span>⚠️ Device Screen Inactive — Click to Share Screen</span>
        </button>
      );
    }
    if (attendanceStatus === 'on_break') {
      return (
        <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-semibold">
          <PauseCircle size={14} className="text-amber-400" />
          <span>⏸️ On Break — Monitoring Paused (No Screenshots Taken)</span>
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
    <div className="bg-white text-slate-800 border-b border-slate-200/80 px-4 py-2 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        
        {/* Left: Status & Transparent Notice */}
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-200/60 shadow-xs">
            <Shield size={15} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {getStatusBadge()}
            <span className="text-[11px] text-slate-400 hidden lg:inline">
              Company Policy (Every {Math.round((screenshotConfig.intervalSeconds || 300) / 60)} min • Paused on Break)
            </span>
          </div>
        </div>

        {/* Right: Metrics & Actions */}
        <div className="flex items-center space-x-4 sm:space-x-5 text-slate-600">
          
          {/* Next Shot Countdown (only active during active work session) */}
          {attendanceStatus === 'checked_in' && (
            <div className="flex items-center space-x-1.5 font-mono text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
              <Camera size={13} className="text-emerald-600 animate-spin" />
              <span>
                Capture in: <strong className="text-slate-900">
                  {Math.floor(nextScreenshotCountdown / 60)}m {String(nextScreenshotCountdown % 60).padStart(2, '0')}s
                </strong>
              </span>
            </div>
          )}

          {/* Last Shot Time */}
          <div className="hidden sm:flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase font-medium">Last Shot</span>
            <span className="font-semibold text-slate-800">{latestScreenshot ? latestScreenshot.captureTime : 'N/A'}</span>
          </div>

          {/* Total Captured Today */}
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase font-medium">Captured Today</span>
            <span className="font-semibold text-indigo-600">{screenshots.length} Shots</span>
          </div>

          {/* Session Duration */}
          <div className="hidden md:flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase font-medium">Duration</span>
            <span className="font-semibold text-slate-800">{hrs}h {mins}m</span>
          </div>

          {/* Action Triggers */}
          {attendanceStatus === 'checked_in' && (
            <button
              onClick={() => captureRealScreenNow().catch(e => console.warn(e))}
              className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs shadow-xs transition cursor-pointer"
              title="Capture real employee workstation screen right now"
            >
              <Camera size={13} />
              <span className="hidden sm:inline">Capture Now</span>
            </button>
          )}

          <button
            onClick={() => setIsScreenshotModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-xs shadow-xs transition cursor-pointer"
          >
            <Eye size={13} />
            <span>History</span>
          </button>
        </div>

      </div>
    </div>
  );
};
