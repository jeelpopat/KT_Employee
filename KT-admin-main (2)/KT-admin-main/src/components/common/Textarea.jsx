import React, { forwardRef } from 'react';

export const Textarea = forwardRef(({
  label,
  id,
  rows = 3,
  error,
  helperText,
  required = false,
  isDisabled = false,
  className = '',
  containerClassName = '',
  maxLength,
  value,
  ...props
}, ref) => {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={textareaId} className="block text-xs font-medium text-slate-700">
            {label}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          {maxLength && value && (
            <span className="text-[10px] text-slate-400">
              {value.length}/{maxLength}
            </span>
          )}
        </div>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        disabled={isDisabled}
        maxLength={maxLength}
        value={value}
        className={`w-full rounded-lg border text-xs sm:text-sm transition-all duration-150 focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed px-3 py-2 bg-white ${
          error
            ? 'border-rose-300 text-rose-900 focus:border-rose-500 focus:ring-rose-200/50'
            : 'border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500/10 hover:border-slate-300'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-[11px] text-rose-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-[11px] text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
});

Textarea.displayName = 'Textarea';
export default Textarea;
