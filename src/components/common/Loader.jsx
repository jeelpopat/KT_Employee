import React from 'react';
import companyLogo from '../../assets/Logo.png';

/**
 * Top Progress Bar
 * Sleek, NProgress-style thin indeterminate accent progress bar for tab/page transitions.
 */
export const TopProgressBar = () => (
  <div className="top-loader-line" role="progressbar" aria-label="Loading..." />
);

/**
 * Skeleton Loader Component
 * Replaces jarring spinners with realistic layout placeholders with smooth shimmer animation.
 */
export const Skeleton = ({ className = '', rounded = 'rounded-md' }) => (
  <div
    aria-hidden="true"
    className={`skeleton-shimmer ${rounded} ${className}`}
  />
);

/**
 * Sleek Dual-Ring Brand Spinner
 */
export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10',
  };
  const s = sizes[size] || sizes.md;
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${s} ${className}`}>
      <svg className="animate-spin w-full h-full text-slate-200" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          style={{ color: '#0088cc' }}
        />
      </svg>
    </div>
  );
};

/**
 * Modern Loading Screen / Container
 * Replaces the old bulky 68vh preloader card with a clean, high-tier, professional loading state.
 */
export const LoadingScreen = ({
  message = 'Loading data...',
  description,
  fullScreen = false,
  className = '',
}) => {
  if (fullScreen) {
    return (
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/95 backdrop-blur-xs font-poppins px-4 ${className}`}
        role="status"
        aria-live="polite"
      >
        <TopProgressBar />
        <div className="flex flex-col items-center max-w-sm text-center">
          <div className="relative mb-5">
            <img
              src={companyLogo}
              alt="Kevalon Technology"
              className="h-10 w-auto object-contain animate-pulse"
            />
          </div>
          <div className="w-44 h-1 bg-slate-200/80 rounded-full overflow-hidden mb-3">
            <div className="h-full w-1/2 bg-gradient-to-r from-[#034665] via-[#068DCB] to-[#38bdf8] rounded-full loading-progress-bar" />
          </div>
          <p className="text-xs font-medium text-slate-600 tracking-wide flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0088cc] animate-ping" />
            <span>{message || 'Verifying session...'}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full py-10 px-4 flex flex-col items-center justify-center text-center font-poppins ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs max-w-sm w-full">
        <div className="flex items-center justify-center mb-3">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50/70 border border-sky-100 text-[#0088cc]">
            <Spinner size="md" />
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-800 tracking-tight">
          {message || 'Loading...'}
        </p>
        {description && (
          <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
            {description}
          </p>
        )}
        <div className="mt-3.5 mx-auto w-32 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-gradient-to-r from-[#034665] to-[#068DCB] rounded-full loading-progress-bar" />
        </div>
      </div>
    </div>
  );
};

/**
 * Table Skeleton Loader
 */
export const TableSkeleton = ({ rows = 5, cols = 5 }) => {
  return (
    <div className="w-full bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs" role="status" aria-label="Loading table">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 w-full">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <Skeleton
              key={`head-skel-${cIdx}`}
              className={`h-3.5 ${cIdx === 0 ? 'w-28' : cIdx === cols - 1 ? 'w-16 ml-auto' : 'w-20'}`}
            />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={`row-skel-${rIdx}`} className="px-4 py-3.5 flex items-center justify-between gap-4">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div key={`cell-skel-${cIdx}`} className={`flex items-center gap-2 ${cIdx === 0 ? 'w-48' : cIdx === cols - 1 ? 'w-20 justify-end' : 'grow'}`}>
                {cIdx === 0 && <Skeleton className="w-7 h-7 rounded-full shrink-0" />}
                <Skeleton
                  className={`h-3.5 ${
                    cIdx === 0
                      ? 'w-28'
                      : cIdx === cols - 1
                      ? 'w-14'
                      : 'w-24'
                  }`}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Metric Card Skeleton
 */
export const CardSkeleton = () => {
  return (
    <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-3" role="status" aria-label="Loading card">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-2.5 w-36" />
    </div>
  );
};

/**
 * Full Page Skeleton
 * High-tier dashboard skeleton displayed seamlessly during tab transitions.
 */
export const PageSkeleton = () => (
  <div className="space-y-5 animate-fade-in font-poppins" role="status" aria-label="Loading page">
    <TopProgressBar />
    {/* Page Header */}
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-3.5 w-64 max-w-full" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
    </div>

    {/* Metric Cards */}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map((item) => (
        <CardSkeleton key={item} />
      ))}
    </div>

    {/* Filter Bar */}
    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
      <Skeleton className="h-9 w-64 rounded-lg" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
    </div>

    {/* Data Table */}
    <TableSkeleton rows={5} cols={5} />
  </div>
);

/**
 * Compact Inline Loader
 */
export const InlineLoader = ({ text = 'Loading...', size = 'sm', className = '' }) => (
  <div className={`inline-flex items-center gap-2 text-xs text-slate-500 font-medium ${className}`}>
    <Spinner size={size} />
    <span>{text}</span>
  </div>
);

export default Spinner;
