import * as React from 'react';
import { cn } from '../../lib/utils';

type CardDivProps = React.HTMLAttributes<HTMLDivElement>;
type CardHeadingProps = React.HTMLAttributes<HTMLHeadingElement>;

const Card = React.forwardRef<HTMLDivElement, CardDivProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-none border border-slate-200 bg-white/95 text-slate-900 shadow-sm',
      className,
    )}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, CardDivProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-4 pb-2', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, CardHeadingProps>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-base font-semibold leading-none tracking-tight', className)}
      {...props}
    >
      {children}
    </h3>
  ),
);
CardTitle.displayName = 'CardTitle';

const CardContent = React.forwardRef<HTMLDivElement, CardDivProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 pt-2', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardContent };
