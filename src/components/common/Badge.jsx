import React from 'react';

export const Badge = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = true,
  className = ''
}) => {
  const variants = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/70',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/70',
    info: 'bg-sky-50 text-sky-700 border-sky-200/70',
    purple: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
    neutral: 'bg-slate-50 text-slate-700 border-slate-200/80',
    primary: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    secondary: 'bg-rose-50 text-rose-700 border-rose-200/80',
  };

  const dots = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    info: 'bg-sky-500',
    purple: 'bg-indigo-500',
    neutral: 'bg-slate-400',
    primary: 'bg-indigo-600',
    secondary: 'bg-rose-600',
  };

  const sizes = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-0.5 gap-1.5 font-medium',
    lg: 'text-xs px-3 py-1 gap-1.5 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center w-fit shrink-0 rounded-md border ${variants[variant] || variants.neutral} ${sizes[size]} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dots[variant] || dots.neutral} shrink-0`}
        />
      )}
      <span className="whitespace-nowrap">{children}</span>
    </span>
  );
};

export default Badge;
