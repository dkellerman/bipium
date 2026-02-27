import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

const SheetContext = React.createContext({
  open: false,
  onOpenChange: () => {},
});

const Sheet = ({ open = false, onOpenChange = () => {}, children }) => {
  return <SheetContext.Provider value={{ open, onOpenChange }}>{children}</SheetContext.Provider>;
};

const SheetTrigger = ({ children }) => children;

const SheetClose = ({ children }) => {
  const { onOpenChange } = React.useContext(SheetContext);
  return React.cloneElement(children, {
    onClick: e => {
      children.props?.onClick?.(e);
      onOpenChange(false);
    },
  });
};

const SheetContent = ({ side = 'right', className, children }) => {
  const { open, onOpenChange } = React.useContext(SheetContext);
  const [rendered, setRendered] = React.useState(open);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    let timer;
    if (open) {
      setRendered(true);
      timer = window.setTimeout(() => setVisible(true), 10);
    } else if (rendered) {
      setVisible(false);
      timer = window.setTimeout(() => setRendered(false), 220);
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [open, rendered]);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = e => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!rendered) return null;

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
          'fixed z-50 h-full w-[320px] border-slate-200 bg-gradient-to-b from-sky-50 to-slate-50 p-6 pt-12 shadow-xl transition-transform duration-200',
          side === 'right'
            ? `right-0 top-0 border-l ${visible ? 'translate-x-0' : 'translate-x-full'}`
            : `left-0 top-0 border-r ${visible ? 'translate-x-0' : '-translate-x-full'}`,
          className,
        )}
        onClick={e => e.stopPropagation()}
      >
        {children}
        <button
          type="button"
          className="absolute right-4 top-4 rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>
      </aside>
    </>
  );
};

const SheetHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-2 text-left', className)} {...props} />
);

const SheetTitle = React.forwardRef(({ className, children, ...props }, ref) => (
  <h2 ref={ref} className={cn('text-lg font-semibold text-slate-800', className)} {...props}>
    {children}
  </h2>
));
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = React.forwardRef(({ className, children, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-slate-600', className)} {...props}>
    {children}
  </p>
));
SheetDescription.displayName = 'SheetDescription';

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
