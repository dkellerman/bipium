import { useCallback, useRef } from 'react';
import { useRanger } from 'react-ranger';
import { StyledRange, RangeTrack, RangeTick, RangeTickLabel, RangeHandle } from './App.styles';

let rangeId = 0;

export const Range = ({ ticks: customTicks = [], ...props }) => {
  const { getTrackProps, handles, ticks } = useRanger({
    values: [props.value],
    onChange: props.disabled ? () => {} : vals => props.onChange?.(vals[0]),
    onDrag: props.disabled ? () => {} : vals => props.onDrag?.(vals[0]),
    min: parseInt(props.min, 10),
    max: parseInt(props.max, 10),
    stepSize: parseInt(props.step, 10),
    ticks: customTicks,
  });

  const trackId = useRef(`range-${++rangeId}`);

  const handleTrackClick = useCallback(
    e => {
      e.preventDefault();
      e.stopPropagation();

      const track = e.target || e.srcElement;
      if (props.disabled || track?.id !== trackId.current) return;

      const rect = track.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const w = track.clientWidth || 0;
      const val = Math.round((x / w) * (props.max - props.min) + props.min);

      (props.onChange || props.onDrag)?.(val);
    },
    [props],
  );

  return (
    <StyledRange hasTicks={customTicks?.length > 0} disabled={props.disabled}>
      <RangeTrack {...getTrackProps()} onClick={handleTrackClick} id={trackId.current}>
        {ticks.map(({ value, getTickProps }) => (
          <RangeTick {...getTickProps()}>
            <RangeTickLabel
              rotation={props.labelRotation}
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                if (props.disabled) return;
                (props.onChange || props.onDrag)?.(value);
              }}
            >
              {value}
            </RangeTickLabel>
          </RangeTick>
        ))}
        {handles.map(({ getHandleProps }) => (
          <RangeHandle {...getHandleProps()} />
        ))}
      </RangeTrack>
    </StyledRange>
  );
};
