import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, RefreshCw } from 'lucide-react';

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

export const RefreshFeedback = () => {
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const activeRequests = useRef(new Set());
  const manualRefresh = useRef(null);

  useEffect(() => {
    const finishManualRefresh = () => {
      const current = manualRefresh.current;
      if (!current || (current.started > 0 && current.inFlight > 0)) return;

      clearTimeout(current.completionTimer);
      current.completionTimer = setTimeout(() => {
        if (manualRefresh.current !== current) return;
        if (current.started > 0 && current.inFlight > 0) return;
        if (current.failed) {
          showToast('Refresh failed. Please try again.', 'error');
        } else if (current.fromCache && !current.successful) {
          showToast('Latest available data loaded.', 'success');
        } else if (current.successful) {
          showToast('Data refreshed successfully.', 'success');
        }
        clearTimeout(current.timeout);
        manualRefresh.current = null;
      }, 500);
    };

    const handleClick = (event) => {
      const button = event.target.closest?.('button');
      if (!button || button.disabled) return;
      const label = [
        button.getAttribute('aria-label'),
        button.getAttribute('title'),
        button.textContent,
      ].filter(Boolean).join(' ');
      if (!/\b(refresh|reload|sync)\b/i.test(label)) return;

      if (manualRefresh.current) {
        clearTimeout(manualRefresh.current.timeout);
        clearTimeout(manualRefresh.current.completionTimer);
      }
      const current = { started: 0, inFlight: 0, successful: false, failed: false, fromCache: false };
      current.timeout = setTimeout(() => {
        if (manualRefresh.current !== current) return;
        showToast('Refresh is taking longer than expected.', 'warning');
        manualRefresh.current = null;
      }, 30000);
      manualRefresh.current = current;
      showToast('Refreshing data...', 'info');
    };

    const handleDataSync = (event) => {
      const { type, requestId, timestamp } = event.detail || {};
      if (type === 'start') {
        activeRequests.current.add(requestId);
        setIsSyncing(true);
        if (manualRefresh.current) {
          manualRefresh.current.started += 1;
          manualRefresh.current.inFlight += 1;
        }
      } else if (type === 'success' || type === 'error') {
        activeRequests.current.delete(requestId);
        setIsSyncing(activeRequests.current.size > 0);
        if (type === 'success') setLastSyncedAt(timestamp || Date.now());
        const current = manualRefresh.current;
        if (current) {
          current.inFlight = Math.max(0, current.inFlight - 1);
          if (type === 'success') current.successful = true;
          else current.failed = true;
          finishManualRefresh();
        }
      } else if (type === 'cached' && manualRefresh.current) {
        manualRefresh.current.fromCache = true;
        finishManualRefresh();
      }
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener('app_data_sync', handleDataSync);
    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('app_data_sync', handleDataSync);
      if (manualRefresh.current) {
        clearTimeout(manualRefresh.current.timeout);
        clearTimeout(manualRefresh.current.completionTimer);
      }
    };
  }, []);

  if (!lastSyncedAt && !isSyncing) return null;
  const lastSyncedLabel = lastSyncedAt
    ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}`
    : 'Waiting for first update';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-3 left-3 z-[9998] inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-[11px] font-medium text-slate-600 shadow-md backdrop-blur"
    >
      <RefreshCw size={13} className={isSyncing ? 'animate-spin text-sky-600' : 'text-emerald-600'} />
      <span>{isSyncing ? 'Syncing data...' : `Data sync · ${lastSyncedLabel}`}</span>
    </div>
  );
};

export default Toast;
