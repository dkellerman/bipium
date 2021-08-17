import styled, { css } from 'styled-components';

// css generated from http://danielstern.ca/range.css

export const Range = styled.input.attrs({ type: 'range' })`
  ${({ thumbWidth = '36px', thumbHeight = '36px' }) => css`
    width: 100%;
    margin: 13.8px 0;
    background-color: transparent;
    -webkit-appearance: none;
    border: 0;

    &:focus {
      outline: none;
    }

    &::-webkit-slider-runnable-track {
      background: #3071a9;
      border: 0.2px solid #010101;
      border-radius: 1.3px;
      width: 100%;
      height: 8.4px;
      cursor: pointer;
    }

    &::-webkit-slider-thumb {
      margin-top: -14px;
      width: ${thumbWidth};
      height: ${thumbHeight};
      background: #ffffff;
      border: 1px solid #000000;
      border-radius: 50%;
      cursor: pointer;
      -webkit-appearance: none;
    }

    &:focus::-webkit-slider-runnable-track {
      background: #367ebd;
    }

    &::-moz-range-track {
      background: #3071a9;
      border: 0.2px solid #010101;
      border-radius: 1.3px;
      width: 100%;
      height: 8.4px;
      cursor: pointer;
    }

    &::-moz-range-thumb {
      width: ${thumbWidth};
      height: ${thumbHeight};
      background: #ffffff;
      border: 1px solid #000000;
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
      background: #2a6495;
      border: 0.2px solid #010101;
      border-radius: 2.6px;
    }

    &::-ms-fill-upper {
      background: #3071a9;
      border: 0.2px solid #010101;
      border-radius: 2.6px;
    }

    &::-ms-thumb {
      width: ${thumbWidth};
      height: ${thumbHeight};
      background: #ffffff;
      border: 1px solid #000000;
      border-radius: 3px;
      cursor: pointer;
      margin-top: 0px;
      /*Needed to keep the Edge thumb centred*/
    }

    &:focus::-ms-fill-lower {
      background: #3071a9;
    }

    &:focus::-ms-fill-upper {
      background: #367ebd;
    }

    /*TODO: Use one of the selectors from https://stackoverflow.com/a/20541859/7077589 and figure out
    how to remove the vertical space around the range input in IE*/
    @supports (-ms-ime-align:auto) {
      /* Pre-Chromium Edge only styles, selector taken from hhttps://stackoverflow.com/a/32202953/7077589 */
      & {
        margin: 0;
        /*Edge starts the margin from the thumb, not the track as other browsers do*/
      }
    }
  `}
`;
