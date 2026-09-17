import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Clock, 
  User, 
  Play, 
  Pause, 
  HardDrive, 
  Sliders,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  StopCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

export const AdminScreenshotPortal = () => {
  const { 
    screenshots, 
    screenshotConfig, 
    setScreenshotConfig,
    attendanceStatus,
    checkInTime,
    checkOutTime,
    workSeconds,
    latestScreenshot,
    inactivityEvents
  } = useApp();

  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all');
  const [selectedSessionFilter, setSelectedSessionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxRecord, setLightboxRecord] = useState(null);

  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);

  const hrs = Math.floor(workSeconds / 3600);
  const mins = Math.floor((workSeconds % 3600) / 60);

  const filteredScreenshots = screenshots.filter(s => {
    const matchesEmp = selectedEmployeeFilter === 'all' || s.employeeId === selectedEmployeeFilter;
    const matchesSession = selectedSessionFilter === 'all' || s.sessionId === selectedSessionFilter;
    const matchesSearch = s.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.activeWindow.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesEmp && matchesSession && matchesSearch;
  });

  const handleIntervalChange = (interval) => {
    setScreenshotConfig(prev => ({ ...prev, intervalSeconds: interval }));
  };

  const earliestShotTime = screenshots[screenshots.length - 1]?.captureTime || checkInTime;
  const latestShotTime = latestScreenshot ? latestScreenshot.captureTime : 'N/A';

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-zinc-900 text-white rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6 border border-zinc-800">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-700">
              Admin Monitoring Portal
            </span>
            <span className="text-xs text-zinc-400 font-mono">• Silent Background Capture</span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Work Activity & Screenshot Portal</h2>
          <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
            Silent background screenshot capture during active employee sessions. Configure intervals, review captured frames, and inspect 5-minute inactivity event logs.
          </p>
        </div>

        {/* Interval Controller */}
        <div className="bg-zinc-800/80 p-4 rounded-xl border border-zinc-700/80 space-y-2 shrink-0">
          <span className="text-[10px] font-semibold uppercase text-zinc-400 block">Capture Interval</span>
          <div className="flex items-center space-x-2">
            {[5, 10, 30, 60].map((sec) => (
              <button
                key={sec}
                onClick={() => handleIntervalChange(sec)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  screenshotConfig.intervalSeconds === sec
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
          <p className="text-[10px] text-zinc-400">Current: Every {screenshotConfig.intervalSeconds}s (Hidden from user)</p>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="bg-zinc-900 text-zinc-200 rounded-2xl border border-zinc-800 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Active Session Metrics</h3>
          </div>
          
          <div>
            {attendanceStatus === 'checked_in' && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Active Capturing</span>
              </span>
            )}
            {attendanceStatus === 'on_break' && (
              <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold flex items-center space-x-1.5">
                <Pause size={12} className="text-amber-400" />
                <span>Paused (Break)</span>
              </span>
            )}
            {attendanceStatus === 'checked_out' && (
              <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-semibold">
                Stopped
              </span>
            )}
          </div>
        </div>

        {/* Timestamps Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          <div className="bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/60">
            <span className="text-[10px] uppercase font-semibold text-zinc-400 flex items-center space-x-1">
              <PlayCircle size={12} />
              <span>Start Time</span>
            </span>
            <span className="font-mono font-semibold text-white text-sm mt-1 block">{checkInTime}</span>
          </div>

          <div className="bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/60">
            <span className="text-[10px] uppercase font-semibold text-zinc-400 flex items-center space-x-1">
              <StopCircle size={12} />
              <span>End Time</span>
            </span>
            <span className="font-mono font-semibold text-white text-sm mt-1 block">
              {checkOutTime ? checkOutTime : 'Active'}
            </span>
          </div>

          <div className="bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/60">
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block">First Shot</span>
            <span className="font-mono font-semibold text-zinc-200 text-sm mt-1 block">{earliestShotTime}</span>
          </div>

          <div className="bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/60">
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Latest Shot</span>
            <span className="font-mono font-semibold text-zinc-200 text-sm mt-1 block">{latestShotTime}</span>
          </div>

          <div className="bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/60">
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Total Shots</span>
            <span className="font-mono font-semibold text-white text-sm mt-1 block">{screenshots.length} Shots</span>
          </div>

          <div className="bg-zinc-800/60 p-3 rounded-xl border border-zinc-700/60">
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Active Work</span>
            <span className="font-mono font-semibold text-zinc-200 text-sm mt-1 block">{hrs}h {mins}m</span>
          </div>
        </div>
      </div>

      {/* 5-Minute Inactivity Logs */}
      <div className="bg-white rounded-2xl border border-zinc-200/70 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">Inactivity Event Log</h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-mono text-xs font-medium">
            {inactivityEvents.length} Events
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b border-zinc-100 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Inactivity Start</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Session ID</th>
                <th className="py-3 px-4">Employee Response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium">
              {inactivityEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-zinc-50/60 transition">
                  <td className="py-3 px-4">
                    <span className="font-semibold text-zinc-900">{evt.employeeName}</span>
                    <span className="text-[10px] text-zinc-400 font-mono block">{evt.employeeId}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-700">{evt.startTime}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/60 font-medium">
                      {evt.duration}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-600">{evt.sessionId}</td>
                  <td className="py-3 px-4">
                    {evt.responseStatus === 'Acknowledged - Working' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-medium flex items-center space-x-1 w-fit">
                        <CheckCircle2 size={12} />
                        <span>Acknowledged - Working</span>
                      </span>
                    )}
                    {evt.responseStatus === 'Switched to Break' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 text-xs font-medium flex items-center space-x-1 w-fit">
                        <Pause size={12} />
                        <span>Switched to Break</span>
                      </span>
                    )}
                    {evt.responseStatus === 'Waiting for Employee Response' && (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 text-xs font-medium flex items-center space-x-1 w-fit">
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

      {/* Storage & Policies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-zinc-200/70 shadow-xs p-5 lg:col-span-2 space-y-3">
          <div className="flex items-center space-x-2 border-b border-zinc-100 pb-3">
            <HardDrive size={16} className="text-zinc-700" />
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">Storage Hierarchy</h3>
          </div>
          <p className="text-xs text-zinc-500">
            Screenshots are compressed and saved in date/session buckets:
          </p>
          <div className="p-3 bg-zinc-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto border border-zinc-800">
            s3://company-vault / EMP-8492 / 2026 / 08 / 20 / SES-001 / screenshot-145.webp
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 pt-1">
            <span className="flex items-center space-x-1"><CheckCircle2 size={13} className="text-emerald-500" /> <span>WebP Compression</span></span>
            <span className="flex items-center space-x-1"><CheckCircle2 size={13} className="text-emerald-500" /> <span>Lazy Loading</span></span>
            <span className="flex items-center space-x-1"><CheckCircle2 size={13} className="text-emerald-500" /> <span>AES-256 Encrypted</span></span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/70 shadow-xs p-5 space-y-3">
          <div className="flex items-center space-x-2 border-b border-zinc-100 pb-3">
            <Sliders size={16} className="text-zinc-700" />
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">Governance</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 bg-zinc-50 rounded-xl">
              <span className="font-medium text-zinc-700">Pause on Break</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">Enabled</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-zinc-50 rounded-xl">
              <span className="font-medium text-zinc-700">Inactivity Trigger</span>
              <span className="font-mono font-semibold text-zinc-900">5 Continuous Mins</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-zinc-50 rounded-xl">
              <span className="font-medium text-zinc-700">Dashboard Indicator</span>
              <span className="px-2 py-0.5 rounded bg-zinc-200 text-zinc-700 font-semibold">Hidden</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-zinc-200/70 shadow-xs p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center space-x-1.5 text-xs">
            <User size={14} className="text-zinc-400" />
            <select
              value={selectedEmployeeFilter}
              onChange={e => setSelectedEmployeeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-50 border border-zinc-200/80 rounded-xl text-zinc-800 focus:outline-none transition cursor-pointer"
            >
              <option value="all">All Employees</option>
              <option value="EMP-8492">Alex Morgan (EMP-8492)</option>
              <option value="EMP-1024">Rahul Patel (EMP-1024)</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 text-xs">
            <Clock size={14} className="text-zinc-400" />
            <select
              value={selectedSessionFilter}
              onChange={e => setSelectedSessionFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-50 border border-zinc-200/80 rounded-xl text-zinc-800 focus:outline-none transition cursor-pointer"
            >
              <option value="all">All Work Sessions</option>
              <option value="SES-20260820-001">SES-20260820-001 (Alex Morgan)</option>
              <option value="SES-20260820-002">SES-20260820-002 (Rahul Patel)</option>
            </select>
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search employee, window..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200/80 rounded-xl text-zinc-800 focus:outline-none transition"
          />
        </div>
      </div>

      {/* Gallery */}
      <div className="bg-white rounded-2xl border border-zinc-200/70 shadow-xs overflow-hidden">
        
        <div className="p-4 bg-zinc-50/50 border-b border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">Activity Gallery</h3>
            <p className="text-[11px] text-zinc-400">{filteredScreenshots.length} screenshots available</p>
          </div>

          <button
            onClick={() => setIsPlayingTimeline(!isPlayingTimeline)}
            className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-xs transition cursor-pointer"
          >
            {isPlayingTimeline ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlayingTimeline ? 'Pause Playback' : 'Chronological Auto-Play'}</span>
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredScreenshots.map((scr) => (
            <div 
              key={scr.id}
              onClick={() => setLightboxRecord(scr)}
              className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs hover:border-zinc-400 transition cursor-pointer group p-2.5 space-y-2"
            >
              <div className="relative rounded-xl overflow-hidden bg-zinc-900 h-36">
                <img 
                  src={scr.thumbnailUrl} 
                  alt={scr.activeWindow} 
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-zinc-900/80 text-white text-[10px] font-mono font-semibold">
                  #{scr.sequenceNo}
                </span>
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-zinc-900 text-white text-[10px] font-semibold">
                  {scr.activityLevel}% Activity
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-900 truncate">{scr.employeeName}</span>
                  <span className="text-[10px] font-mono font-semibold text-zinc-500">{scr.employeeId}</span>
                </div>
                <p className="text-xs text-zinc-500 truncate font-normal">{scr.activeWindow}</p>
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono pt-1 border-t border-zinc-100">
                  <span>{scr.captureTime}</span>
                  <span>{scr.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Lightbox Modal */}
      {lightboxRecord && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-zinc-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col lg:flex-row max-h-[90vh]">
            
            <div className="flex-1 bg-black p-4 flex items-center justify-center relative">
              <img 
                src={lightboxRecord.fullUrl} 
                alt={lightboxRecord.activeWindow} 
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
              <span className="absolute top-4 left-4 bg-zinc-900/80 text-white font-mono text-xs px-3 py-1 rounded-full border border-zinc-700">
                Sequence #{lightboxRecord.sequenceNo}
              </span>
            </div>

            <div className="w-full lg:w-80 bg-zinc-900 p-5 text-white border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Screenshot Detail</h3>
                  <button 
                    onClick={() => setLightboxRecord(null)}
                    className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 bg-zinc-800/70 rounded-xl border border-zinc-700/60">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Employee</span>
                    <span className="text-xs font-semibold text-white mt-0.5 block">{lightboxRecord.employeeName}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">{lightboxRecord.employeeId}</span>
                  </div>

                  <div className="p-3 bg-zinc-800/70 rounded-xl border border-zinc-700/60">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Timestamp</span>
                    <span className="text-xs font-semibold text-zinc-200 mt-0.5 block">{lightboxRecord.date} at {lightboxRecord.captureTime}</span>
                  </div>

                  <div className="p-3 bg-zinc-800/70 rounded-xl border border-zinc-700/60">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Active Window</span>
                    <span className="text-xs font-semibold text-zinc-200 mt-0.5 block truncate">{lightboxRecord.activeWindow}</span>
                  </div>

                  <div className="p-3 bg-zinc-800/70 rounded-xl border border-zinc-700/60">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Activity Level</span>
                    <span className="font-mono font-semibold text-emerald-400 mt-0.5 block">{lightboxRecord.activityLevel}%</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setLightboxRecord(null)}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

