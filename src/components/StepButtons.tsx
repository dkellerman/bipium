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
        className={cn('size-[53.6px] p-[11.2px] text-[30.4px]', 'sm:size-12 sm:p-[8.8px]')}
        disabled={disableIncrement}
        onClick={onIncrement}
      >
        +
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn('size-[53.6px] p-[11.2px] text-[30.4px]', 'sm:size-12 sm:p-[8.8px]')}
        disabled={disableDecrement}
        onClick={onDecrement}
      >
        -
      </Button>
    </div>
  );
}
