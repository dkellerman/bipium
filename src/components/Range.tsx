import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

type RangeValueChange = (value: number) => void;

interface RangeProps {
  ticks?: number[];
  labelRotation?: number;
  tickClassName?: string;
  disabled?: boolean;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange?: RangeValueChange;
  onDrag?: RangeValueChange;
}

export const Range = ({
  ticks: customTicks = [],
  labelRotation = 0,
  tickClassName,
  disabled = false,
  min,
  max,
  step,
  value,
  onChange,
  onDrag,
}: RangeProps) => {
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
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={vals => callback?.(vals[0])}
      />

      {hasTicks && (
        <div className={cn('relative select-none', compactTicks ? '-mt-3 h-6' : '-mt-5 h-10')}>
          {customTicks.map((tick, idx) => {
            const left = `${((tick - min) / (max - min)) * 100}%`;
            const isFirst = idx === 0;
            const isLast = idx === customTicks.length - 1;
            const xOffset = isFirst ? '-25%' : isLast ? '-100%' : '-50%';

            return (
              <button
                type="button"
                key={`tick-${tick}`}
                disabled={disabled}
                className={cn(
                  'absolute top-0 h-10 px-0.5 text-[18px] leading-none text-slate-600',
                  'hover:text-slate-800 disabled:cursor-not-allowed sm:text-[17px]',
                  tickClassName,
                )}
                style={{ left, transform: `translateX(${xOffset})` }}
                onClick={() => callback?.(tick)}
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
