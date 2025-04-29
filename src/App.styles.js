import styled, { css } from 'styled-components';
import { FiSettings } from 'react-icons/fi';
import { RiCloseLine } from 'react-icons/ri';
import { TiVolume, TiVolumeMute } from 'react-icons/ti';

export const darkBlue = '#3071a9';
export const green = 'forestgreen';
export const lightBlue = 'aliceblue';
export const gray = '#999';
export const lightGray = '#eee';
export const red = 'red';
export const bloodRed = '#b91c1c';
export const emeraldGreen = '#16803c';
export const black = '#010101';
export const white = '#fefefe';

export const smallFontSize = '14px';
export const bodyFontSize = '20px';
export const bodyCondensedFontSize = '18px';
export const largeCondensedFontSize = '24px';
export const largeFontSize = '28px';
export const xlargeFontSize = '36px';

export const divColor = 0xbbbbbb;
export const subDivColor = 0x666666;
export const nowLineColor = 0x00ff00;
export const incorrectNoteColor = 0xff0000;
export const correctNoteColor = 0x00ff00;

export const rangeHandleWidth = 36;
export const rangeHandleHeight = 36;
export const rangeHandleColor = white;
export const rangeTrackHeight = 7;
export const rangeTrackColor = lightGray;
export const rangeTickWidth = 2;
export const rangeTickHeight = 10;
export const rangeTickColor = gray;

export const countFont = {
  fill: 0xffffff,
  fontFamily: 'monospace',
  strokeThickness: 10,
};

export const condensedHeight = '639px';

export const Layout = styled.main`
  background: ${white};
  color: ${black};
  font-size: ${bodyFontSize};
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  align-items: center;
  padding: 0 0 40px 0;

  /* Generic hover zoom for all buttons and clickable icons */
  button, svg {
    transition: transform 0.15s ease-in-out;
    &:hover {
      cursor: pointer;
      transform: scale(1.03);
    }
  }

  nav {
    width: 100%;
    padding: 0 0 10px 0;
    background: ${lightBlue};
    h1 {
      margin: 0;
      padding: 10px 0;
      text-align: center;
      font-size: 36px;
    }
    a {
      text-decoration: none;
      font-size: 26px;
    }
  }

  select {
    padding: 0 5px;
    height: 50px;
    font-size: ${bodyCondensedFontSize};
    border-radius: 0;
    color: ${black};
    -webkit-text-fill-color: ${black};
  }

  select option {
    color: ${black};
  }

  @media only screen and (max-height: ${condensedHeight}) {
    &,
    select {
      font-size: ${bodyCondensedFontSize};
    }
    select {
      height: 45px;
    }
  }

  fieldset {
    margin: 7px 0 5px 0;
    padding: 10px;
    border: 1px solid ${lightGray};
    text-align: center;
    white-space: nowrap;
  }

  input,
  label {
    margin: 0 10px;
  }

  input[type='checkbox'] {
    margin: 0;
    zoom: 2;
    vertical-align: middle;
    @media only screen and (max-height: ${condensedHeight}) {
      zoom: 1.5;
    }
  }

  small {
    font-size: ${smallFontSize};
  }
`;

export const Nav = styled.nav`
  background: ${lightBlue};
  padding: 0;
  margin: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: relative;

  h3,
  h3 a {
    padding: 0;
    margin: 3px;
    text-align: center !important;
    border: 0;
    color: ${green};
    font-weight: bold;
    font-variant: small-caps;
    span:not(.bipium) {
      filter: brightness(1.3);
    }
  }

  @media only screen and (max-height: ${condensedHeight}) {
    h3 {
      font-size: 32px;
    }
  }
`;

export const StartButton = styled.button`
  color: ${white};
  background: ${emeraldGreen};
  border-radius: 50%;
  padding: 16px;
  margin-top: 15px;
  font-size: ${largeFontSize};
  @media only screen and (max-height: ${condensedHeight}) {
    font-size: ${largeFontSize};
    margin-top: 5px;
  }
`;

export const StopButton = styled(StartButton)`
  color: ${white};
  background: ${bloodRed};
`;

export const TapButton = styled.button`
  color: ${black};
  background: ${white};
  border-radius: 50%;
  border-color: black;
  border-width: 2px;
  padding: 15px 25px;
  margin-bottom: 5px;
  font-size: ${smallFontSize};
  @media only screen and (max-height: ${condensedHeight}) {
    padding: 10px 25px;
  }
`;

export const StepButton = styled.button`
  color: ${black};
  background: ${white};
  padding: 12px;
  margin: 0px 0 12px 5px;
  background: ${lightGray};
  font-size: 18px;
  @media only screen and (max-height: ${condensedHeight}) {
    padding: 6px 12px 6px 12px;
  }
`;

export const AboutPage = styled.main`
  padding: 30px;
  h2 {
    margin-bottom: 10px;
  }
  ul {
    padding-left: 20px;
    li {
      margin: 10px 0;
    }
  }
  li p {
    display: inline-block;
    margin-left: 0px;
    padding: 0;
    max-width: 600px;
  }
`;

export const CloseIcon = styled(RiCloseLine).attrs({
  size: 32,
})`
  position: absolute;
  top: 13px;
  right: 15px;
  z-index: 10000;
  &:hover {
    cursor: pointer;
  }
  @media only screen and (max-height: ${condensedHeight}) {
    width: 24px;
    height: 24px;
  }
`;

export const SettingsIcon = styled(FiSettings).attrs({
  size: 24,
})`
  position: absolute;
  top: 11px;
  right: 15px;
  z-index: 1000;
  @media only screen and (max-height: ${condensedHeight}) {
    width: 20px;
    height: 20px;
  }
`;

export const Divider = styled.div`
  border-top: 1px solid ${gray};
  padding-top: 10px;
  width: 85%;
`;

export const SideBar = styled.aside`
  position: fixed;
  top: 0;
  height: 100vh;
  width: 320px;
  background: ${lightBlue};
  z-index: 1000;
  padding: 58px 25px 0 25px;
  box-shadow: -2px 3px 4px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  transition: transform 0.4s ease;
  right: 0;
  transform: translateX(${props => props.show ? '0' : '320px'});

  @media only screen and (min-width: 1024px) {
    right: calc(50% - 240px);
    transform: translateX(${props => props.show ? '320px' : '0'});
  }

  ul {
    list-style: none;
    padding-left: 12px;
    li {
      margin: 10px 0 20px 0;

      ::before {
        content: '';
      }

      ${Divider} {
        margin: 40px 0 20px 0;
      }
    }
  }
`;

const volumeIconSize = 28;
const volumeIconStyle = css`
  position: relative;
  left: -12px;
  vertical-align: -9px;
  transition: transform 0.15s ease-in-out;
  &:hover {
    cursor: pointer;
    transform: scale(1.03);
  }
`;

const VolumeIconUnmuted = styled(TiVolume).attrs({ size: volumeIconSize })`
  ${volumeIconStyle}
`;

const VolumeIconMuted = styled(TiVolumeMute).attrs({ size: volumeIconSize })`
  ${volumeIconStyle}
`;

export const VolumeIcon = ({ muted = false, ...props }) => {
  return muted ? <VolumeIconMuted {...props} /> : <VolumeIconUnmuted {...props} />;
};

const VolumeSlider = styled.div`
  @media only screen and (min-width: 668px) {
    margin-top: 20px;
  }
  .range {
    display: inline-block;
    width: 180px;
  }
`;

export const VolumeSliderMain = styled(VolumeSlider)``;

export const VolumeSliderSide = styled(VolumeSlider)`
  margin-bottom: 40px;
`;

export const SoundPack = styled.div`
  label {
    margin-left: 0;
  }
  select {
    display: inline-block;
    background: ${white};
  }
`;

export const ButtonAsLink = styled.button`
  &,
  &:hover,
  &:active {
    background: transparent;
    border: 0;
    box-shadow: none;
    padding: 0;
    margin: 13px 0 0 0;
    border-bottom: 1px dotted ${gray};
    font-size: ${bodyCondensedFontSize};
  }
`;

export const BPMField = styled.fieldset`
  && {
    border: 0;
    margin-top: 25px;
    padding: 0;
  }

  @media only screen and (max-width: 668px) {
    && {
      margin-top: 15px;
      margin-bottom: 5px;
    }
  }

  @media only screen and (max-height: ${condensedHeight}) {
    && {
      margin-top: 8px;
    }
  }

  input[type='number'] {
    display: ${props => (props.editing ? 'inline-block' : 'none')};
  }

  label {
    display: ${props => (props.editing ? 'none' : 'inline-block')};
    border-bottom: 1px dotted ${gray};
    transition: transform 0.15s ease-in-out;
    &:hover {
      cursor: pointer;
      transform: scale(1.03);
    }
  }

  label,
  input[type='number'] {
    margin: 0 40px;
    font-size: ${largeFontSize};
    width: 100px;
  }

  @media only screen and (max-height: ${condensedHeight}) {
    label,
    input[type='number'] {
      font-size: ${largeCondensedFontSize};
    }
  }

  @media only screen and (max-width: 374px) {
    label,
    input[type='number'] {
      margin: 0 20px;
    }
  }

  .range {
    display: inline-block;
    margin-top: 25px;
    margin-bottom: 15px;
    width: calc(100% - 20px);
    @media only screen and (max-height: ${condensedHeight}) {
      margin-top: 15px;
      margin-bottom: 10px;
    }
  }
`;

export const BeatsField = styled.fieldset`
  && {
    border: 0;
  }
  select {
    display: inline-block;
  }
  button {
    margin-bottom: 0;
  }
  @media only screen and (max-height: ${condensedHeight}) {
    && {
      margin-bottom: 0;
      margin-top: 3px;
    }
  }
`;

export const PlaySubDivsField = styled.fieldset`
  && {
    text-align: left;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    border: 0;
    padding: 18px 14px;
    margin-top: 3px;
    background: ${white};
  }
  select,
  input[type='checkbox'] {
    display: inline-block;
  }
`;

export const SwingField = styled.div`
  display: flex;
  margin-top: 15px;
  width: 100%;

  label {
    padding-top: 15px;
    margin-left: 0;
    margin-right: 10px;
    font-size: ${bodyCondensedFontSize};
    width: 83px;
    color: ${({ disabled }) => disabled && gray};
  }
  .range {
    flex: 1;
    padding-top: 18px;
    margin-bottom: 10px;
  }
  @media only screen and (max-height: ${condensedHeight}) {
    margin-top: 8px;
  }
`;

export const VisualizerField = styled.fieldset`
  box-shadow: 3px 3px 3px ${lightGray};
  && {
    padding-bottom: 5px;
  }
  @media only screen and (max-height: ${condensedHeight}) {
    && {
      padding: 0;
    }
  }
`;

export const StyledRange = styled.div.attrs({ className: 'range' })`
  padding: 0 0 ${({ hasTicks }) => (hasTicks ? '30px' : '0')} 0;
  ${({ disabled }) =>
    disabled &&
    css`
      div {
        color: ${gray};
      }
    `}
`;

export const RangeTrack = styled.div`
  height: ${rangeTrackHeight}px;
  background: ${rangeTrackColor};
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
  border-radius: 2px;
`;

export const RangeTick = styled.div`
  :before {
    content: '';
    position: absolute;
    left: 0;
    background: ${rangeTickColor};
    height: ${rangeTickHeight}px;
    width: ${rangeTickWidth}px;
    transform: translate(-50%, 0.7rem);
  }
`;

export const RangeTickLabel = styled.div`
  position: absolute;
  font-size: 17px;
  color: ${black};
  top: 100%;
  transform: translate(-50%, 1.2rem) ${({ rotation }) => rotation && `rotate(${rotation}deg)`};
  white-space: nowrap;
  padding-top: 5px;
  border-bottom: 1px dotted ${gray};
  &:hover {
    cursor: pointer;
  }
  @media only screen and (max-height: ${condensedHeight}) {
    font-size: 16px;
  }
`;

export const RangeHandle = styled.div`
  width: ${rangeHandleWidth}px;
  height: ${rangeHandleHeight}px;
  border-radius: 100%;
  background: ${rangeHandleColor};
  border: solid 1px ${gray};
  transition: transform 0.15s ease-in-out;
  &:hover {
    cursor: pointer;
    transform: scale(1.05);
  }
`;
