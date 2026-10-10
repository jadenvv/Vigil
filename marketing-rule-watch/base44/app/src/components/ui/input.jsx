import { forwardRef } from 'react';

const Input = forwardRef(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`flex h-9 w-full rounded-md border border-paper-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-night-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lamp-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
));

Input.displayName = 'Input';

export { Input };
