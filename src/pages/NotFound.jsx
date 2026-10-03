import React from "react";
import { Compass, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  const handleGoHome = () => {
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-xs">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-200/60 text-indigo-600 shadow-xs">
        <Compass size={28} />
      </div>
      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">404 Error</span>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Page Not Found</h1>
      <p className="mt-2 max-w-md text-xs text-slate-500 leading-relaxed">
        The requested screen or URL route does not exist or has been relocated. Please choose an authorized workspace section from the sidebar.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Go Back</span>
        </button>
        <button
          type="button"
          onClick={handleGoHome}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 cursor-pointer transition-colors"
        >
          <Home size={14} />
          <span>Return to Dashboard</span>
        </button>
      </div>
    </div>
  );
}
