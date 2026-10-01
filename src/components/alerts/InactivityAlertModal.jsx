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
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Warning Header */}
        <div className="bg-amber-600 dark:bg-amber-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/20 rounded-xl shrink-0 backdrop-blur-xs">
              <AlertTriangle size={24} className="text-white animate-bounce" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">5-Minute Inactivity Alarm</h3>
              <p className="text-xs text-amber-100 font-medium">No mouse or keyboard activity detected</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-[11px] font-bold animate-pulse">
            <BellRing size={13} />
            <span>Alarm</span>
          </span>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 rounded-xl text-slate-700 dark:text-slate-300 leading-relaxed font-medium space-y-2">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-300">
              Are you taking a break or still working?
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Zero mouse movement, cursor movement, or keyboard typing has been detected for <strong>5 continuous minutes</strong>.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-500">
              Please choose an option below to ensure your work hours and break time are logged accurately:
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-3">

          <button
            type="button"
            onClick={handleInactivityStartBreak}
            className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-sm hover:shadow-md cursor-pointer"
          >
            <Coffee size={15} />
            <span>Start Break</span>
          </button>

          <button
            type="button"
            onClick={handleAcknowledgeWorking}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-sm hover:shadow-md cursor-pointer"
          >
            <CheckCircle2 size={15} />
            <span>I Am Working</span>
          </button>

        </div>

      </div>
    </div>
  );
};


