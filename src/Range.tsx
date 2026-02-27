import { Slider } from './components/ui/slider';
import { cn } from './lib/utils';
import type { RangeProps } from './types';

export const Range = ({
  ticks: customTicks = [],
  labelRotation = 0,
  disabled = false,
  min,
  max,
  step,
  value,
  onChange,
  onDrag,
}: RangeProps) => {
  const minNum = Number(min);
  const maxNum = Number(max);
  const stepNum = Number(step);
  const currentValue = Number.isFinite(Number(value)) ? Number(value) : minNum;
  const callback = onDrag || onChange;
  const hasTicks = customTicks.length > 0;
  const compactTicks = labelRotation === 0;

  return (
    <div
      className={cn(
        'w-full',
        hasTicks && (compactTicks ? 'pb-5' : 'pb-8'),
        disabled && 'pointer-events-none opacity-55',
      )}
    >
      <Slider
        min={minNum}
        max={maxNum}
        step={stepNum}
        value={[currentValue]}
        disabled={disabled}
        onValueChange={vals => callback?.(vals[0])}
      />

      {hasTicks && (
        <div className={cn('relative select-none', compactTicks ? '-mt-3 h-6' : '-mt-5 h-10')}>
          {customTicks.map((tick, idx) => {
            const left = `${((Number(tick) - minNum) / (maxNum - minNum)) * 100}%`;
            const isFirst = idx === 0;
            const isLast = idx === customTicks.length - 1;
            const xOffset = isFirst ? '-25%' : isLast ? '-100%' : '-50%';

            return (
              <button
                type="button"
                key={`tick-${tick}`}
                disabled={disabled}
                className={cn(
                  'absolute top-0 h-10 px-0.5 text-[16px] leading-none text-slate-600',
                  'hover:text-slate-800 disabled:cursor-not-allowed sm:text-[17px]',
                )}
                style={{ left, transform: `translateX(${xOffset})` }}
                onClick={() => callback?.(Number(tick))}
              >
                <span className="absolute left-1/2 -top-px h-[16px] w-px -translate-x-1/2 bg-slate-500" />
                <span
                  className={cn(
                    'absolute left-1/2 inline-block whitespace-nowrap border-b border-dotted border-slate-400',
                    compactTicks ? 'top-[8px]' : 'top-[11px]',
                  )}
                  style={
                    labelRotation === 0
                      ? { transform: 'translateX(-50%)', transformOrigin: 'top center' }
                      : {
                          transform: `translateX(-100%) rotate(${labelRotation}deg)`,
                          transformOrigin: 'top right',
                        }
                  }
                >
                  {tick}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
