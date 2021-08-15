import styled from 'styled-components';
import { FiSettings } from 'react-icons/fi';
import { RiCloseLine } from 'react-icons/ri';
import { TiVolume } from 'react-icons/ti';

export const divColor = 0xbbbbbb;
export const subDivColor = 0x666666;
export const nowLineColor = 0x00ff00;
export const incorrectNoteColor = 0xff0000;
export const correctNoteColor = 0x00ff00;

export const countFont = {
  fill: 0xffffff,
  fontFamily: 'monospace',
  strokeThickness: 10,
};

export const Layout = styled.main`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  align-items: center;

  fieldset {
    margin: 5px 0;
    padding: 10px;
    border: 1px solid #ccc;
    text-align: center;
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
    font-size: 14px;
  }
`;

export const Nav = styled.nav`
  background: aliceblue;
  padding: 0;
  margin: 0;

  h3,
  h3 a {
    width: 100%;
    padding: 0;
    margin: 5px;
    text-align: center !important;
    border: 0;
    color: forestgreen;
    font-weight: bold;
    font-variant: small-caps;
  }
`;

export const StartButton = styled.button`
  color: white;
  background: forestgreen;
  border-radius: 50%;
  padding: 20px;
  margin-top: 15px;
  font-size: 40px;
`;

export const StopButton = styled(StartButton)`
  color: white;
  background: red;
`;

export const TapButton = styled.button`
  color: black;
  background: white;
  border-radius: 50%;
  padding: 12px 20px;
  margin-bottom: 5px;
  float: right;
  position: relative;
  left: 50px;
`;

export const ListenButton = styled.button`
  border-radius: 50%;
  padding: 13px;
`;

export const StepButton = styled.button`
  color: black;
  background: white;
  padding: 10px;
  margin: 0 0 12px 5px;
  background: #eee;
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
  position: fixed;
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
  position: fixed;
  top: 13px;
  left: 25px;
  z-index: 1000;
  &:hover {
    cursor: pointer;
  }
`;

export const SideBar = styled.aside`
  position: fixed;
  top: 58px;
  left: 0;
  height: 100vh;
  width: 320px;
  background: aliceblue;
  z-index: 1000;
  padding-left: 32px;
  padding-top: 0px;
  box-shadow: 2px 3px 4px rgba(0, 0, 0, 0.15);
  overflow: auto;

  div {
    margin: 15px 0;
  }

  .divider {
    border-top: 1px solid #999;
    padding-top: 10px;
    width: 85%;
    margin-top: 50px;
    div {
      margin: 20px 0;
    }
  }
`;

export const VolumeIcon = styled(TiVolume).attrs({ size: 28 })`
  vertical-align: 6px;
  position: relative;
  left: -6px;
`;

export const VolumeSlider = styled.div`
  input {
    display: inline-block;
    width: 180px;
  }
`;

export const SoundPack = styled.div`
  label {
    margin-left: 0;
  }
  select {
    display: inline-block;
    background: white;
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
    margin: 15px 0;
  }
`;

export const BPMField = styled.fieldset`
  margin-top: 10px;

  && {
    border: 0;
  }

  input[type='number'] {
    display: ${props => (props.editing ? 'inline-block' : 'none')};
  }

  input[type='range'] {
    display: inline-block;
    position: relative;
    left: 35px;
  }

  label {
    display: ${props => (props.editing ? 'none' : 'inline-block')};
    font-size: 28px;
  }
`;

export const BeatsField = styled.fieldset`
  padding: 0;
  margin: 0;
  && {
    border: 0;
  }
  select {
    display: inline-block;
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
  margin-left: 0;
  label {
    display: block;
  }
  input {
    display: inline-block;
  }
`;
