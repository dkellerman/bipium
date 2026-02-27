import * as React from 'react';
import { cn } from '../../lib/utils';

type SeparatorOrientation = 'horizontal' | 'vertical';

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: SeparatorOrientation;
  decorative?: boolean;
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = 'horizontal', decorative = true, ...props }: SeparatorProps, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden={decorative}
        className={cn(
          'shrink-0 bg-slate-300',
          orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
          className,
        )}
        {...props}
      />
    );
  },
);
Separator.displayName = 'Separator';

export { Separator };
