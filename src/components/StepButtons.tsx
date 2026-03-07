import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StepButtonsProps {
  onIncrement: () => void;
  onDecrement: () => void;
  disableIncrement: boolean;
  disableDecrement: boolean;
  incrementLabel: string;
  decrementLabel: string;
}

export function StepButtons({
  onIncrement,
  onDecrement,
  disableIncrement,
  disableDecrement,
  incrementLabel,
  decrementLabel,
}: StepButtonsProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn('size-14 p-3 text-3xl', 'sm:size-12 sm:p-2')}
        disabled={disableIncrement}
        title={incrementLabel}
        aria-label={incrementLabel}
        onClick={onIncrement}
      >
        +
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn('size-14 p-3 text-3xl', 'sm:size-12 sm:p-2')}
        disabled={disableDecrement}
        title={decrementLabel}
        aria-label={decrementLabel}
        onClick={onDecrement}
      >
        -
      </Button>
    </div>
  );
}
