import React from 'react';
import { Loader2 } from 'lucide-react';
import companyLogo from '../../assets/Logo.png';

export const Skeleton = ({ className = '', rounded = 'rounded-md' }) => (
  <div
    aria-hidden="true"
    className={`skeleton-shimmer ${rounded} ${className}`}
  />
);

export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };
  return <Loader2 className={`animate-spin text-primary ${sizes[size]} ${className}`} />;
};

export const LoadingScreen = ({
  message = 'Loading...',
  description,
  fullScreen = false,
  className = '',
}) => (
  <div
    className={`relative flex w-full items-center justify-center overflow-hidden px-4 py-10 ${
      fullScreen
        ? 'min-h-screen bg-[radial-gradient(ellipse_at_top,_#e7f6fc_0%,_#f8fafc_48%,_#f1f5f9_100%)]'
        : 'min-h-[min(68vh,560px)]'
    } ${className}`}
    role="status"
    aria-live="polite"
  >
    <div className="pointer-events-none absolute -left-20 top-8 h-56 w-56 rounded-full bg-sky-200/20 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-24 -right-12 h-72 w-72 rounded-full bg-cyan-200/20 blur-3xl" />
    <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/80 bg-white/95 px-7 py-9 text-center shadow-[0_24px_80px_-28px_rgba(3,70,101,0.28)] backdrop-blur sm:px-10 sm:py-11">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#034665] via-[#068DCB] to-[#5ed4df]" />
      <img
        src={companyLogo}
        alt="Kevalon Technology"
        className="mx-auto h-16 w-52 object-contain"
      />
      <div className="mx-auto mt-8 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-sky-50 to-cyan-100/70 shadow-inner">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-sky-100">
          <span className="absolute inset-[-3px] rounded-full border-[3px] border-transparent border-t-[#034665] border-r-[#068DCB] animate-spin" />
          <Loader2 className="h-6 w-6 text-[#068DCB]" />
        </div>
      </div>
      <p className="mt-6 text-lg font-semibold tracking-tight text-slate-800">{message}</p>
      <p className="mt-2 text-sm text-slate-500">
        {description || 'We are getting everything ready for you.'}
      </p>
      <div className="mx-auto mt-7 h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-slate-100">
        <div className="loading-progress-bar h-full w-[38%] rounded-full bg-gradient-to-r from-[#034665] via-[#068DCB] to-[#5ed4df]" />
      </div>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        Please wait
      </p>
    </div>
  </div>
);

export const TableSkeleton = ({ rows = 5, cols = 5 }) => {
  return (
    <div className="w-full space-y-3 p-4" role="status" aria-label="Loading table">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center space-x-4">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <Skeleton key={cIdx} className="h-4 grow" rounded="rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton = () => {
  return (
    <div className="p-6 bg-white rounded-2xl border border-gray-200/80 shadow-card space-y-4" role="status" aria-label="Loading card">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="w-8 h-8" rounded="rounded-xl" />
      </div>
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
};

export const PageSkeleton = () => (
  <div className="space-y-5" role="status" aria-label="Loading page">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      <Skeleton className="h-9 w-28" rounded="rounded-lg" />
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map((item) => <CardSkeleton key={item} />)}
    </div>
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24" rounded="rounded-lg" />
      </div>
      <TableSkeleton rows={6} cols={4} />
    </div>
  </div>
);

export default Spinner;
