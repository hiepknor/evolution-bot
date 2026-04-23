import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-input/70 bg-background/80 px-3 py-2 text-sm text-[hsl(var(--text-strong))] ring-offset-background placeholder:text-foreground/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_hsl(var(--background))] [&:-webkit-autofill]:[-webkit-text-fill-color:hsl(var(--text-strong))] [&:-webkit-autofill:hover]:shadow-[inset_0_0_0px_1000px_hsl(var(--background))] [&:-webkit-autofill:focus]:shadow-[inset_0_0_0px_1000px_hsl(var(--background))]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
