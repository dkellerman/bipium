import * as React from 'react';
import { cn } from '../../lib/utils';

interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: number[] | number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onValueChange?: (value: number[]) => void;
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      className,
      value = [0],
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      onValueChange,
      ...props
    },
    ref,
  ) => {
    const trackRef = React.useRef<HTMLDivElement | null>(null);
    const current = Array.isArray(value) ? value[0] : value;
    const dragging = React.useRef(false);
    const minNum = Number(min);
    const maxNum = Number(max);
    const stepNum = Number(step) || 1;
    const safeCurrent = Number.isFinite(Number(current)) ? Number(current) : minNum;
    const pct = ((safeCurrent - minNum) / (maxNum - minNum || 1)) * 100;

    const emitFromClientX = React.useCallback(
      (clientX: number) => {
        if (!trackRef.current || disabled) {
          return;
        }

        const rect = trackRef.current.getBoundingClientRect();
        const clampedX = Math.max(rect.left, Math.min(rect.right, clientX));
        const ratio = (clampedX - rect.left) / (rect.width || 1);
        const rawVal = minNum + ratio * (maxNum - minNum);
        const stepped = Math.round(rawVal / stepNum) * stepNum;
        const nextVal = Math.max(minNum, Math.min(maxNum, stepped));
        onValueChange?.([nextVal]);
      },
      [disabled, maxNum, minNum, onValueChange, stepNum],
    );

    React.useEffect(() => {
      const onMouseMove = (event: MouseEvent) => {
        if (!dragging.current) {
          return;
        }
        emitFromClientX(event.clientX);
      };

      const onTouchMove = (event: TouchEvent) => {
        if (!dragging.current) {
          return;
        }
        emitFromClientX(event.touches?.[0]?.clientX ?? 0);
      };

      const onEnd = () => {
        dragging.current = false;
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchend', onEnd);

      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchend', onEnd);
      };
    }, [emitFromClientX]);

    return (
      <div
        ref={ref}
        className={cn('relative flex h-12 w-full touch-none items-center select-none', className)}
        onMouseDown={event => {
          if (disabled) {
            return;
          }
          dragging.current = true;
          emitFromClientX(event.clientX);
        }}
        onTouchStart={event => {
          if (disabled) {
            return;
          }
          dragging.current = true;
          emitFromClientX(event.touches?.[0]?.clientX ?? 0);
        }}
        {...props}
      >
        <div
          ref={trackRef}
          className={cn(
            'h-[7px] w-full rounded-[3px] border border-slate-400 bg-slate-200',
            'shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]',
            disabled && 'opacity-60',
          )}
        />
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'absolute top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full',
            'border-2 border-slate-400 bg-white shadow-sm',
          )}
          style={{ left: `${pct}%` }}
          onMouseDown={event => {
            event.preventDefault();
            event.stopPropagation();
            if (disabled) {
              return;
            }
            dragging.current = true;
          }}
        />
      </div>
    );
  },
);
Slider.displayName = 'Slider';

export { Slider };
