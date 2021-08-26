import styled, { css } from 'styled-components';
import { DebounceInput } from 'react-debounce-input';
import { black, white, lightBlue, gray, lightGray } from './App.styles';

const trackColor = lightGray;

// css generated from http://danielstern.ca/range.css

export const Range = ({ ticks = [], debounceTimeout = 0, ...props }) => {
  return (
    <>
      <StyledRange debounceTimeout={debounceTimeout} {...props} />
      {Boolean(ticks?.length) && (
        <Ticks>
          {ticks.map(val => (
            <Tick
              key={`tick-${val}`}
              label={val}
              pct={(val - props.min) / (props.max - props.min)}
              onClick={e => {
                props.onChange?.({ ...e, target: { value: val } });
              }}
            ></Tick>
          ))}
        </Ticks>
      )}
    </>
  );
};

const THUMB_WIDTH = 36;
const THUMB_HEIGHT = 36;

const StyledRange = styled(DebounceInput).attrs({ type: 'range' })`
  ${({ thumbWidth = THUMB_WIDTH, thumbHeight = THUMB_HEIGHT }) => css`
    && {
      border: 0;
      margin: 13.8px 0;
      background-color: transparent;
      -webkit-appearance: none;
      padding-left: 0;
      padding-right: 0;
    }

    &:focus {
      outline: none;
    }

    &::-webkit-slider-runnable-track {
      background: ${trackColor};
      border: 0.2px solid ${black};
      border-radius: 1.3px;
      width: 100%;
      height: 8.4px;
      cursor: pointer;
    }

    &::-webkit-slider-thumb {
      margin-top: -14px;
      width: ${thumbWidth}px;
      height: ${thumbHeight}px;
      background: ${white};
      border: 1px solid #000000;
      border-radius: 50%;
      cursor: pointer;
      -webkit-appearance: none;
    }

    &::-moz-range-track {
      background: ${trackColor};
      border: 0.2px solid ${black};
      border-radius: 1.3px;
      width: 100%;
      height: 8.4px;
      cursor: pointer;
    }

    &::-moz-range-thumb {
      width: ${thumbWidth}px;
      height: ${thumbHeight}px;
      background: #ffffff;
      border: 1px solid ${black};
      border-radius: 50%;
      cursor: pointer;
    }

    &::-ms-track {
      background: transparent;
      border-color: transparent;
      border-width: 14.8px 0;
      color: transparent;
      width: 100%;
      height: 8.4px;
      cursor: pointer;
    }

    &::-ms-fill-lower {
      background: ${lightBlue};
      border: 0.2px solid ${black};
      border-radius: 2.6px;
    }

    &::-ms-fill-upper {
      background: ${trackColor};
      border: 0.2px solid ${black};
      border-radius: 2.6px;
    }

    &::-ms-thumb {
      width: ${thumbWidth}px;
      height: ${thumbHeight}px;
      background: ${white};
      border: 1px solid ${black};
      border-radius: 3px;
      cursor: pointer;
      margin-top: 0px;
      /* Needed to keep the Edge thumb centred */
    }

    /* TODO: Use one of the selectors from https://stackoverflow.com/a/20541859/7077589 and figure out
    how to remove the vertical space around the range input in IE */
    @supports (-ms-ime-align: auto) {
      /* Pre-Chromium Edge only styles, selector taken from hhttps://stackoverflow.com/a/32202953/7077589 */
      & {
        margin: 0;
        /* Edge starts the margin from the thumb, not the track as other browsers do */
      }
    }
  `}
`;

const Ticks = styled.div`
  display: flex;
  padding-top: 0;
  padding-bottom: 0;
  padding-left: 38px; // 12.66% ??
  padding-right: 9px; // 3% ??
  position: relative;
  top: ${-1 * (THUMB_HEIGHT / 2)}px;
`;

const Tick = styled.span`
  position: relative;
  left: ${({ pct }) => `calc((100% - ${THUMB_WIDTH}px) * ${pct})`};
  width: 1px;
  background: ${gray};
  height: 15px;
  margin-bottom: 15px;

  ::after {
    content: '${({ label }) => `${label}`}';
    font-size: 18px;
    margin-top: 20px;
    display: flex;
    justify-content: center;
  }

  &:hover {
    cursor: pointer;
  }
`;
