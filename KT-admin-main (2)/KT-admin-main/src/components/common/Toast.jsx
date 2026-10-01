import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const Toast = ({ message, type = 'success', onClose }) => {
  if (!message) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-primary shrink-0" />,
  };

  const bgColors = {
    success: 'bg-emerald-50/90 border-emerald-200 text-emerald-900',
    error: 'bg-red-50/90 border-red-200 text-red-900',
    info: 'bg-primary-50/90 border-primary-200 text-primary-900',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-down">
      <div
        className={`flex items-center space-x-3 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-md transition-all ${bgColors[type]}`}
      >
        {icons[type]}
        <span className="text-xs font-semibold">{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default Toast;
