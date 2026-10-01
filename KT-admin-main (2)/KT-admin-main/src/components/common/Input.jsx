import React, { forwardRef } from 'react';

export const Input = forwardRef(({
  label,
  id,
  type = 'text',
  error,
  helperText,
  required = false,
  isDisabled = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-slate-700 mb-1">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative rounded-lg shadow-xs">
        {LeftIcon && (
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <LeftIcon className="w-3.5 h-3.5" />
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={isDisabled}
          className={`w-full rounded-lg border text-xs sm:text-sm transition-all duration-150 focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
            LeftIcon ? 'pl-8' : 'pl-3'
          } ${RightIcon ? 'pr-8' : 'pr-3'} py-1.5 bg-white ${
            error
              ? 'border-rose-300 text-rose-900 focus:border-rose-500 focus:ring-rose-200/50'
              : 'border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500/10 hover:border-slate-300'
          } ${className}`}
          {...props}
        />
        {RightIcon && (
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
            <RightIcon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      {error ? (
        <p className="mt-1 text-[11px] text-rose-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-[11px] text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
