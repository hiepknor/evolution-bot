import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
}

export function Progress({ value, className, ...props }: ProgressProps): JSX.Element {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)} {...props}>
      <div
        className="h-full bg-primary transition-all"
        style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
      />
    </div>
  );
}
