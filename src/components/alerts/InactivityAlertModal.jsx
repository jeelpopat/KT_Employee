import React from 'react';
import { AlertTriangle, CheckCircle, Coffee } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

export const InactivityAlertModal = () => {
  const { 
    isInactivityAlertOpen, 
    handleAcknowledgeWorking, 
    handleInactivityStartBreak 
  } = useApp();

  if (!isInactivityAlertOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200/80 shadow-2xl overflow-hidden">
        
        {/* Warning Header */}
        <div className="bg-zinc-900 text-white p-5 flex items-center space-x-3">
          <div className="p-2 bg-amber-500/20 rounded-xl shrink-0 border border-amber-500/30">
            <AlertTriangle size={20} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Work Activity Alert</h3>
            <p className="text-xs text-zinc-400 font-medium">5+ Minutes Continuous Inactivity</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          <div className="p-3.5 bg-zinc-50 border border-zinc-200/70 rounded-xl text-zinc-700 leading-relaxed font-medium space-y-1">
            <p>No keyboard/mouse activity detected for more than <strong>5 continuous minutes</strong>.</p>
            <p className="text-[11px] text-zinc-500">Please confirm your current work status or start your official break.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-zinc-50/80 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-end gap-2">
          
          <button
            onClick={handleInactivityStartBreak}
            className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition cursor-pointer"
          >
            <Coffee size={14} />
            <span>Start Break</span>
          </button>

          <button
            onClick={handleAcknowledgeWorking}
            className="w-full sm:w-auto px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition cursor-pointer"
          >
            <CheckCircle size={14} />
            <span>I Am Working</span>
          </button>

        </div>

      </div>
    </div>
  );
};

