import React from 'react';
import { AlertTriangle, CheckCircle2, Coffee, BellRing } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

export const InactivityAlertModal = () => {
  const {
    isInactivityAlertOpen,
    handleAcknowledgeWorking,
    handleInactivityStartBreak
  } = useApp();

  if (!isInactivityAlertOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200/90 shadow-xl overflow-hidden animate-fade-in">

        {/* Warning Header */}
        <div className="bg-amber-500 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
              <AlertTriangle size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Inactivity Alert</h3>
              <p className="text-[11px] text-amber-100">No activity detected for 5 minutes</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-semibold">
            <BellRing size={12} />
            <span>Alarm</span>
          </span>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-lg text-slate-700 leading-relaxed font-medium space-y-1.5">
            <p className="text-xs font-semibold text-amber-900">
              Are you taking a break or still working?
            </p>
            <p className="text-[11px] text-slate-600">
              Zero mouse movement or typing has been detected for <strong>5 continuous minutes</strong>.
            </p>
            <p className="text-[10px] text-slate-400">
              Please choose an option below to ensure accurate attendance logging:
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2">

          <button
            type="button"
            onClick={handleInactivityStartBreak}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Coffee size={14} />
            <span>Start Break</span>
          </button>

          <button
            type="button"
            onClick={handleAcknowledgeWorking}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <CheckCircle2 size={14} />
            <span>I Am Working</span>
          </button>

        </div>

      </div>
    </div>
  );
};


