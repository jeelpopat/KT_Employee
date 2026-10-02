import React from 'react';
import { Loader2 } from 'lucide-react';

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
