import React, { useState } from 'react';
import { X, Camera, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

export const ScreenshotHistoryModal = () => {
  const { 
    isScreenshotModalOpen, 
    setIsScreenshotModalOpen, 
    screenshots, 
    user
  } = useApp();

  const [activePreview, setActivePreview] = useState(null);

  if (!isScreenshotModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs"
        onClick={() => setIsScreenshotModalOpen(false)}
      />

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-zinc-200/80 flex flex-col max-h-[90vh]">
          
          {/* Header */}
          <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between border-b border-zinc-800">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-zinc-800 rounded-xl text-zinc-300">
                <Camera size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Screenshot History</h3>
                <p className="text-xs text-zinc-400">
                  {user.name} ({user.employeeId}) • Logged read-only records
                </p>
              </div>
            </div>

            <button 
              onClick={() => setIsScreenshotModalOpen(false)}
              className="p-1 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Privacy Notice Banner */}
          <div className="bg-zinc-50 border-b border-zinc-100 p-3 px-6 text-xs text-zinc-600 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield size={14} className="text-zinc-500 shrink-0" />
              <span>
                Read-only logs captured during active work sessions.
              </span>
            </div>
            <span className="font-mono text-[11px] font-semibold text-zinc-700 shrink-0">
              {screenshots.length} Shots
            </span>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Active Preview */}
            {activePreview && (
              <div className="bg-zinc-900 rounded-2xl p-4 text-white space-y-3 shadow-xs border border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300 font-mono">
                    Session: {activePreview.sessionId} • Sequence #{activePreview.sequenceNo}
                  </span>
                  <button 
                    onClick={() => setActivePreview(null)}
                    className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                  >
                    Close Preview
                  </button>
                </div>

                <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-black">
                  <img 
                    src={activePreview.fullUrl} 
                    alt={`Screenshot ${activePreview.sequenceNo}`} 
                    className="w-full max-h-96 object-contain"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-zinc-800/80 p-3 rounded-xl">
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase font-semibold">Timestamp</span>
                    <span className="font-medium text-zinc-200">{activePreview.date} • {activePreview.captureTime}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase font-semibold">Active Window</span>
                    <span className="font-medium text-zinc-200 truncate block">{activePreview.activeWindow}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase font-semibold">Activity</span>
                    <span className="font-medium text-emerald-400">{activePreview.activityLevel}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase font-semibold">Check-In</span>
                    <span className="font-medium font-mono text-zinc-300">{activePreview.checkInTime}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {screenshots.map(scr => (
                <div 
                  key={scr.id}
                  onClick={() => setActivePreview(scr)}
                  className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs hover:border-zinc-400 transition cursor-pointer group space-y-2 p-2.5"
                >
                  <div className="relative rounded-xl overflow-hidden bg-zinc-900 h-36">
                    <img 
                      src={scr.thumbnailUrl} 
                      alt={`Sequence ${scr.sequenceNo}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-zinc-900/80 text-white text-[10px] font-mono font-semibold">
                      #{scr.sequenceNo}
                    </span>
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-zinc-900 text-white text-[10px] font-semibold">
                      {scr.activityLevel}% Activity
                    </span>
                  </div>

                  <div className="px-1 text-xs space-y-1">
                    <div className="flex justify-between font-semibold text-zinc-900">
                      <span className="truncate">{scr.activeWindow}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                      <span>{scr.captureTime}</span>
                      <span>{scr.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 bg-zinc-50/80 border-t border-zinc-100 flex justify-between items-center text-xs">
            <span className="text-zinc-500">Read-Only View</span>
            <button
              onClick={() => setIsScreenshotModalOpen(false)}
              className="px-4 py-2 bg-zinc-900 text-white font-semibold rounded-xl hover:bg-zinc-800 transition cursor-pointer"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

