import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StepButtonsProps {
  onIncrement: () => void;
  onDecrement: () => void;
  disableIncrement: boolean;
  disableDecrement: boolean;
}

export function StepButtons({
  onIncrement,
  onDecrement,
  disableIncrement,
  disableDecrement,
}: StepButtonsProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn('size-14 p-3 text-3xl', 'sm:size-12 sm:p-2')}
        disabled={disableIncrement}
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
        onClick={onDecrement}
      >
        -
      </Button>
    </div>
  );
}
