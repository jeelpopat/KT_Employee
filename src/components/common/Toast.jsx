import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Global helper to trigger UI toasts from anywhere in the application
 */
export const showToast = (message, type = 'success', duration = 4000) => {
  if (typeof window !== 'undefined' && message) {
    window.dispatchEvent(
      new CustomEvent('app_toast', {
        detail: {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          message: String(message),
          type: type || 'success',
          duration: duration || 4000,
        },
      })
    );
  }
};

/**
 * Toast item component with rich styling and icons
 */
export const ToastItem = ({ id, message, type = 'success', onClose }) => {
  if (!message) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    info: <Info className="w-5 h-5 text-indigo-600 shrink-0" />,
  };

  const bgStyles = {
    success: 'bg-emerald-50/95 border-emerald-300 text-emerald-950 shadow-emerald-500/10 ring-1 ring-emerald-500/20',
    error: 'bg-rose-50/95 border-rose-300 text-rose-950 shadow-rose-500/10 ring-1 ring-rose-500/20',
    warning: 'bg-amber-50/95 border-amber-300 text-amber-950 shadow-amber-500/10 ring-1 ring-amber-500/20',
    info: 'bg-indigo-50/95 border-indigo-300 text-indigo-950 shadow-indigo-500/10 ring-1 ring-indigo-500/20',
  };

  const badgeStyles = {
    success: 'bg-emerald-100/80 text-emerald-800',
    error: 'bg-rose-100/80 text-rose-800',
    warning: 'bg-amber-100/80 text-amber-800',
    info: 'bg-indigo-100/80 text-indigo-800',
  };

  const titles = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Notice',
  };

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 max-w-md w-full animate-in fade-in slide-in-from-top-3 ${
        bgStyles[type] || bgStyles.info
      }`}
    >
      <div className="mt-0.5">{icons[type] || icons.info}</div>
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
              badgeStyles[type] || badgeStyles.info
            }`}
          >
            {titles[type] || 'Notice'}
          </span>
        </div>
        <p className="text-xs sm:text-sm font-semibold leading-relaxed break-words">
          {message}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onClose && onClose(id)}
        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors shrink-0 cursor-pointer"
        aria-label="Close message"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/**
 * Standalone Toast for backward compatibility with pages using <Toast message={...} type={...} onClose={...} />
 */
export const Toast = ({ message, type = 'success', onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed top-5 right-5 sm:top-6 sm:right-6 z-[99999] pointer-events-none">
      <ToastItem message={message} type={type} onClose={onClose} />
    </div>
  );
};

/**
 * Global Toast Container that listens to app_toast events and renders notifications
 */
export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToastEvent = (e) => {
      const detail = e.detail;
      if (!detail || !detail.message) return;

      const id = detail.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast = {
        id,
        message: detail.message,
        type: detail.type || 'success',
      };

      setToasts((prev) => {
        // Keep at most 4 active toasts
        const filtered = prev.filter((t) => t.message !== newToast.message);
        return [...filtered.slice(-3), newToast];
      });

      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, detail.duration || 4500);

      return () => clearTimeout(timer);
    };

    window.addEventListener('app_toast', handleToastEvent);
    return () => window.removeEventListener('app_toast', handleToastEvent);
  }, []);

  const handleDismiss = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 sm:top-6 sm:right-6 z-[99999] pointer-events-none flex flex-col gap-2.5 max-w-sm sm:max-w-md w-[calc(100vw-2.5rem)]">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={handleDismiss}
        />
      ))}
    </div>
  );
};

export default Toast;
