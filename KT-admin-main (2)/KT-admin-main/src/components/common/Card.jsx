import React from 'react';

export const Card = ({
  children,
  className = '',
  hoverEffect = false,
  glass = false,
  padding = 'p-4',
  fit = false,
  ...props
}) => {
  return (
    <div
      className={`rounded-xl border border-slate-200/80 ${
        glass ? 'glass-panel' : 'bg-white'
      } ${
        hoverEffect ? 'hover:shadow-hover hover:border-slate-300 transition-all duration-200' : 'shadow-xs'
      } ${fit ? 'w-fit' : ''} ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', action }) => {
  return (
    <div className={`flex items-center justify-between pb-3 border-b border-slate-100 mb-3 ${className}`}>
      <div>{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
};

export const CardTitle = ({ children, className = '', subtitle }) => {
  return (
    <div>
      <h3 className={`text-sm font-semibold text-slate-900 tracking-tight ${className}`}>{children}</h3>
      {subtitle && <p className="text-xs text-slate-500 font-normal mt-0.5">{subtitle}</p>}
    </div>
  );
};

export const CardContent = ({ children, className = '' }) => {
  return <div className={className}>{children}</div>;
};

export const CardFooter = ({ children, className = '' }) => {
  return (
    <div className={`pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-xs ${className}`}>
      {children}
    </div>
  );
};

export default Card;
