import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { WithChildrenProps } from '../../types';

type OpenChangeFn = (open: boolean) => void;
type SheetSide = 'left' | 'right';
type TimeoutId = ReturnType<typeof setTimeout>;

interface SheetContextValue {
  open: boolean;
  onOpenChange: OpenChangeFn;
}

interface SheetProps extends WithChildrenProps {
  open?: boolean;
  onOpenChange?: OpenChangeFn;
}

interface SheetCloseProps {
  children: React.ReactElement;
}

interface SheetContentProps extends WithChildrenProps {
  side?: SheetSide;
  className?: string;
}

interface SheetHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

interface SheetTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

interface SheetDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const noopOpenChange: OpenChangeFn = () => {};

const defaultSheetContextValue: SheetContextValue = {
  open: false,
  onOpenChange: noopOpenChange,
};

const SheetContext = React.createContext<SheetContextValue>(defaultSheetContextValue);

const Sheet = ({ open = false, onOpenChange = noopOpenChange, children }: SheetProps) => {
  return <SheetContext.Provider value={{ open, onOpenChange }}>{children}</SheetContext.Provider>;
};

const SheetTrigger = ({ children }: WithChildrenProps) => children;

const SheetClose = ({ children }: SheetCloseProps) => {
  const { onOpenChange } = React.useContext(SheetContext);

  return React.cloneElement(children, {
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      children.props?.onClick?.(event);
      onOpenChange(false);
    },
  });
};

const SheetContent = ({ side = 'right', className, children }: SheetContentProps) => {
  const { open, onOpenChange } = React.useContext(SheetContext);
  const [rendered, setRendered] = React.useState(open);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    let timer: TimeoutId | undefined;

    if (open) {
      setRendered(true);
      timer = setTimeout(() => setVisible(true), 10);
    } else if (rendered) {
      setVisible(false);
      timer = setTimeout(() => setRendered(false), 220);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [open, rendered]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!rendered) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close settings"
        className={cn(
          'fixed inset-0 z-50 cursor-default bg-black/45 transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={() => onOpenChange(false)}
      />
      <aside
        className={cn(
          'fixed z-50 h-full w-[320px] border-slate-200 bg-gradient-to-b from-sky-50 to-slate-50',
          'p-6 pt-12 shadow-xl transition-transform duration-200',
          side === 'right'
            ? `right-0 top-0 border-l ${visible ? 'translate-x-0' : 'translate-x-full'}`
            : `left-0 top-0 border-r ${visible ? 'translate-x-0' : '-translate-x-full'}`,
          className,
        )}
        onClick={event => event.stopPropagation()}
      >
        {children}
        <button
          type="button"
          className={cn(
            'absolute right-4 top-4 rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100',
            'focus:outline-none focus:ring-2 focus:ring-sky-400',
          )}
          onClick={() => onOpenChange(false)}
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>
      </aside>
    </>
  );
};

const SheetHeader = ({ className, ...props }: SheetHeaderProps) => (
  <div className={cn('flex flex-col space-y-2 text-left', className)} {...props} />
);

const SheetTitle = React.forwardRef<HTMLHeadingElement, SheetTitleProps>(
  ({ className, children, ...props }, ref) => (
    <h2 ref={ref} className={cn('text-lg font-semibold text-slate-800', className)} {...props}>
      {children}
    </h2>
  ),
);
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = React.forwardRef<HTMLParagraphElement, SheetDescriptionProps>(
  ({ className, children, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-slate-600', className)} {...props}>
      {children}
    </p>
  ),
);
SheetDescription.displayName = 'SheetDescription';

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetDescription };
