import * as React from 'react';
import { createPortal } from 'react-dom';
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
  children: React.ReactElement<{
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  }>;
}

interface SheetContentProps extends WithChildrenProps {
  side?: SheetSide;
  className?: string;
  overlayClassName?: string;
  style?: React.CSSProperties;
  /** A header to open beneath (CSS selector): the sheet drops down from its bottom edge,
   * within its width, and leaves it uncovered so its own button can close the sheet. */
  anchor?: string;
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

const SheetContent = ({
  side = 'right',
  className,
  overlayClassName,
  anchor,
  style,
  children,
}: SheetContentProps) => {
  const { open, onOpenChange } = React.useContext(SheetContext);
  const [rendered, setRendered] = React.useState(open);
  const [visible, setVisible] = React.useState(false);
  const [anchorBox, setAnchorBox] = React.useState<React.CSSProperties | null>(null);

  React.useLayoutEffect(() => {
    if (!anchor || !rendered) return;
    const measure = () => {
      const rect = document.querySelector(anchor)?.getBoundingClientRect();
      if (!rect) return setAnchorBox(null);
      // Down to the bottom of the screen: the window, or the desktop phone frame's screen,
      // whose rounded corners it keeps.
      const screen = document.getElementById('phone-screen');
      const bottom = screen?.getBoundingClientRect().bottom ?? window.innerHeight;
      const radius = screen ? getComputedStyle(screen).borderBottomLeftRadius : undefined;
      const top = Math.max(0, rect.bottom);
      setAnchorBox({
        top,
        left: rect.left,
        width: rect.width,
        height: Math.min(bottom, window.innerHeight) - top,
        borderBottomLeftRadius: radius,
        borderBottomRightRadius: radius,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [anchor, rendered]);

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

  const panel = (
    <aside
      className={cn(
        'z-50 h-full w-[320px] border-slate-200 bg-gradient-to-b from-sky-50 to-slate-50',
        'p-6 pt-12 shadow-xl transition-transform duration-200',
        anchorBox ? 'absolute' : 'fixed',
        side === 'right'
          ? `right-0 top-0 border-l ${visible ? 'translate-x-0' : 'translate-x-full'}`
          : `left-0 top-0 border-r ${visible ? 'translate-x-0' : '-translate-x-full'}`,
        className,
      )}
      style={style}
      onClick={event => event.stopPropagation()}
    >
      {children}
      {!anchor && (
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
      )}
    </aside>
  );

  const overlay = (
    <button
      type="button"
      aria-label="Close settings"
      className={cn(
        'inset-0 z-50 cursor-default bg-black/60 transition-opacity duration-200',
        anchorBox ? 'absolute' : 'fixed',
        visible ? 'opacity-100' : 'opacity-0',
        overlayClassName,
      )}
      onClick={() => onOpenChange(false)}
    />
  );

  // Rendered on the page itself, so on desktop it slides in from the window's edge
  // rather than inside the phone frame. Anchored, it slides out from under the header
  // instead, clipped to the area below it.
  if (anchor) {
    return (
      anchorBox &&
      createPortal(
        <div className="fixed z-50 overflow-hidden" style={anchorBox}>
          {overlay}
          {panel}
        </div>,
        document.body,
      )
    );
  }
  return createPortal(
    <>
      {overlay}
      {panel}
    </>,
    document.body,
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
