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
export const black = '#010101';
export const white = '#fefefe';

export const smallFontSize = '14px';
export const bodyFontSize = '20px';
export const bodyCondensedFontSize = '18px';
export const largeFontSize = '28px';
export const xlargeFontSize = '40px';

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

export const Layout = styled.main`
  background: ${white};
  color: ${black};
  font-size: ${bodyFontSize};
  display: flex;
  flex-direction: column;
  width: 100%;
  align-items: center;
  padding: 0 0 40px 0;

  fieldset {
    margin: 5px 0;
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
  }

  small {
    font-size: ${smallFontSize};
  }
`;

export const Nav = styled.nav`
  background: ${lightBlue};
  padding: 0;
  margin: 0;

  h3,
  h3 a {
    width: 100%;
    padding: 0;
    margin: 5px;
    text-align: center !important;
    border: 0;
    color: ${green};
    font-weight: bold;
    font-variant: small-caps;
  }
`;

export const StartButton = styled.button`
  color: ${white};
  background: ${green};
  border-radius: 50%;
  padding: 20px;
  margin-top: 15px;
  font-size: ${xlargeFontSize};
`;

export const StopButton = styled(StartButton)`
  color: ${white};
  background: ${red};
`;

export const TapButton = styled.button`
  color: ${black};
  background: ${white};
  border-radius: 50%;
  padding: 15px 25px;
  margin-bottom: 5px;
`;

export const StepButton = styled.button`
  color: ${black};
  background: ${white};
  padding: 12px;
  margin: 0 0 12px 5px;
  background: ${lightGray};
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
  left: 25px;
  z-index: 10000;
  &:hover {
    cursor: pointer;
  }
`;

export const SettingsIcon = styled(FiSettings).attrs({
  size: 32,
})`
  position: absolute;
  top: 13px;
  left: 25px;
  z-index: 1000;
  &:hover {
    cursor: pointer;
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
  left: 0;
  height: 100vh;
  width: 320px;
  background: ${lightBlue};
  z-index: 1000;
  padding-left: 32px;
  padding-top: 58px;
  box-shadow: 2px 3px 4px rgba(0, 0, 0, 0.15);
  overflow: auto;
  touch-action: pan-y;

  ul {
    list-style: none;
    padding-left: 12px;
    li {
      margin: 12px 0;

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
  &:hover {
    cursor: pointer;
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

  input[type='number'] {
    display: ${props => (props.editing ? 'inline-block' : 'none')};
  }

  label {
    display: ${props => (props.editing ? 'none' : 'inline-block')};
    border-bottom: 1px dotted ${gray};
    &:hover {
      cursor: pointer;
    }
  }

  label,
  input[type='number'] {
    margin: 0 40px;
    font-size: ${largeFontSize};
    width: 100px;
  }

  @media only screen and (max-width: 374px) {
    label,
    input[type='number'] {
      margin: 0 20px;
    }
  }

  .range {
    display: inline-block;
    margin-top: 15px;
    margin-bottom: 5px;
    width: calc(100% - 20px);
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
`;

export const PlaySubDivsField = styled.fieldset`
  && {
    text-align: left;
  }
  select,
  input[type='checkbox'] {
    display: inline-block;
  }
`;

export const SwingField = styled.div`
  display: flex;
  margin-top: 10px;
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
`;

export const VisualizerField = styled.fieldset`
  box-shadow: 3px 3px 3px ${lightGray};
  && {
    padding-bottom: 5px;
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
  font-size: 18px;
  color: ${black};
  top: 100%;
  transform: translate(-50%, 1.2rem);
  white-space: nowrap;
  padding-top: 5px;
  border-bottom: 1px dotted ${gray};
  &:hover {
    cursor: pointer;
  }
`;

export const RangeHandle = styled.div`
  width: ${rangeHandleWidth}px;
  height: ${rangeHandleHeight}px;
  border-radius: 100%;
  background: ${rangeHandleColor};
  border: solid 1px ${gray};
  &:hover {
    cursor: pointer;
  }
`;
