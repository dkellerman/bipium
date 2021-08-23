/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import qs from 'query-string';
import copyToClipboard from 'copy-to-clipboard';
import useKeypress from 'react-use-keypress';
import NoSleep from 'nosleep.js';
import { Link } from 'react-router-dom';
import localStorage from 'local-storage-fallback';
import { AudioContext } from 'standardized-audio-context';
import {
  Layout,
  StartButton,
  StopButton,
  TapButton,
  StepButton,
  CloseIcon,
  SettingsIcon,
  VolumeIcon,
  VolumeSlider,
  SideBar,
  SoundPack,
  ButtonAsLink,
  BPMField,
  BeatsField,
  PlaySubDivsField,
  SwingField,
  Divider,
  VisualizerField,
} from './App.styles';
import { DefaultVisualizer } from './DefaultVisualizer';
import { useTapBPM, useSetting, useClicker, useMetronome, SOUND_PACKS } from './hooks';
import { NavBar } from './NavBar';
import { Range } from './Range';

const int = x => (x ?? x) && parseInt(x, 10);
const float = x => (x ?? x) && parseFloat(x);
const bool = x => (x ?? x) && [true, 1, '1', 'true', 't'].includes(x);

const bpmMin = 20.0;
const bpmMax = 320.0;
const bpmDefault = 80.0;
const validBpm = val => Math.max(Math.min(bpmMax, val || bpmDefault), bpmMin);

function App() {
  const bpm = useRef();
  const [beats, setBeats] = useSetting('beats', 4, int);
  const [subDivs, setSubDivs] = useSetting('subDivs', 2, int);
  const [swing, setSwing] = useSetting('swing', 0, int);
  const [playSubDivs, setPlaySubDivs] = useSetting('playSubDivs', false, bool);
  const [volume, setVolume] = useSetting('volume', 100, int, localStorage);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);
  const [soundPack, setSoundPack] = useSetting('soundPack', 'defaults', String);
  const [visualizers] = useSetting('visualizers', 'default', val => val.split(','));

  const [showSideBar, setShowSideBar] = useState(false);
  const [copiedURL, setCopiedURL] = useState(null);
  const [, _update] = useState(false);
  const forceRender = () => _update(x => !x);

  // single shared audio context
  const audioContext = useRef(new AudioContext());

  const clicker = useClicker({
    audioContext: audioContext.current,
    volume,
    sounds: SOUND_PACKS[soundPack],
  });

  const m = useMetronome({
    timerFn: () => audioContext.current.currentTime,
    clicker,
    bpm: bpm.current,
    beats,
    subDivs: playSubDivs ? subDivs : 1,
    swing: playSubDivs && subDivs % 2 === 0 ? swing : 0,
    workerUrl: '/dist/worker.min.js',
  });

  const noSleep = useRef(new NoSleep([]));

  const start = useCallback(() => {
    noSleep.current?.enable();
    setStarted(true);
  }, []);

  const stop = useCallback(() => {
    noSleep.current?.disable();
    setStarted(false);
  }, []);

  const toggle = useCallback(() => {
    setStarted(s => !s);
  }, []);

  useEffect(() => {
    if (clicker) clicker.setVolume(muted ? 0 : volume);
  }, [volume, muted]);

  useEffect(() => {
    if (window.location.search.indexOf('?reset') === 0) window.location.replace(`/`);
  }, []);

  // update metronome on the fly when parameters change
  useEffect(() => {
    m.update({
      subDivs: playSubDivs ? subDivs : 1,
      swing: playSubDivs && subDivs % 2 === 0 ? swing : 0,
      beats,
      bpm: bpm.current,
    });
    forceRender();
  }, [playSubDivs, subDivs, swing, beats, m.started]);

  const updateBPM = React.useCallback(val => {
    bpm.current = val;
    if (m.started) {
      m.update({ bpm: val });
    }
  }, []);

  useEffect(() => {
    clicker.setSounds(SOUND_PACKS[soundPack || 'defaults']);
  }, [soundPack]);

  // keyboard handlers
  useKeypress(' ', e => {
    // space: play/stop
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });

  useKeypress('Escape', () => {
    setShowSideBar(false);
  });

  // click anywhere to close sidebar
  useEffect(() => {
    function handleWindowClick(e) {
      if (!e.target.closest('aside') && !e.target.closest('svg')) {
        setShowSideBar(false);
      }
    }
    window.addEventListener('click', handleWindowClick);
    return () => {
      window.removeEventListener('click', handleWindowClick);
    };
  }, []);

  // start/stop
  useEffect(() => {
    if (!started) {
      m?.stop();
    } else {
      m?.start();
    }
    forceRender();

    return () => {
      m?.stop();
    };
  }, [started]);

  useEffect(() => {
    if (showSideBar) {
      setCopiedURL(null);
    }
  }, [showSideBar]);

  const copyConfigurationURL = useCallback(() => {
    const q = { bpm: bpm.current, beats, playSubDivs };
    if (playSubDivs) {
      q.swing = swing;
      q.subDivs = subDivs;
    }
    if (soundPack !== 'defaults') {
      q.soundPack = soundPack;
    }
    const url = qs.stringifyUrl({
      url: `${window.location.protocol}//${window.location.host}`,
      query: q,
    });
    copyToClipboard(url, {
      format: 'text/plain',
      onCopy: () => {
        setCopiedURL(url);
      },
    });
  }, [bpm.current, beats, playSubDivs, soundPack]);

  return (
    <Layout>
      <NavBar />

      {showSideBar ? (
        <CloseIcon onClick={() => setShowSideBar(false)} />
      ) : (
        <SettingsIcon onClick={() => setShowSideBar(true)} />
      )}

      {showSideBar && (
        <SideBar>
          <VolumeSlider>
            <VolumeIcon muted={muted} onClick={() => setMuted(val => !val)} />
            <Range
              min={0}
              max={100}
              step={1}
              value={volume}
              onChange={e => {
                setVolume(int(e.target.value));
              }}
              debounceTimeout={0}
            />
          </VolumeSlider>

          <SoundPack>
            <label>Sound Pack:</label>{' '}
            <select value={soundPack} onChange={e => setSoundPack(e.target.value)}>
              {Object.keys(SOUND_PACKS).map((key, idx) => (
                <option key={`sp-${idx + 1}`} value={key}>
                  {SOUND_PACKS[key]?.name}
                </option>
              ))}
            </select>
          </SoundPack>

          <div>
            <ButtonAsLink onClick={() => window.location.replace(`/?reset`)}>
              Reset all settings
            </ButtonAsLink>
          </div>

          <div>
            <ButtonAsLink onClick={copyConfigurationURL}>Copy configuration URL</ButtonAsLink>

            {copiedURL && (
              <div>
                <small>
                  Copied{' '}
                  <a href={copiedURL} target="_blank" rel="noreferrer">
                    configuration URL
                  </a>{' '}
                  to clipboard.
                </small>
              </div>
            )}
          </div>

          <Divider>
            <div>
              <Link to="/about">About</Link>
            </div>

            <div>
              <a href="https://github.com/dkellerman/bipium" target="_blank" rel="noreferrer">
                Code
              </a>
            </div>

            {process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA && (
              <div>
                <small>Build: {process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA}</small>
              </div>
            )}
          </Divider>
        </SideBar>
      )}

      <BPMArea
        clicker={clicker}
        onChange={val => {
          updateBPM(val);
        }}
      />

      <BeatsField>
        <label>Beats:</label>{' '}
        <select value={beats} onChange={e => setBeats(int(e.target.value))}>
          {new Array(12).fill(0).map((_, idx) => (
            <option key={`beats-${idx + 1}`} value={idx + 1}>
              {idx + 1}
            </option>
          ))}
        </select>
        <StepButtons val={beats} setter={setBeats} min={1} max={12} />
      </BeatsField>

      <PlaySubDivsField>
        <input
          type="checkbox"
          checked={playSubDivs}
          onChange={e => setPlaySubDivs(e.target.checked)}
        />
        <label>Play {!playSubDivs && 'sub divs'}</label>

        {playSubDivs && (
          <>
            <select value={subDivs} onChange={e => setSubDivs(int(e.target.value))}>
              <option value="8">32nd notes</option>
              <option value="7">Septuplets</option>
              <option value="6">Sextuplets</option>
              <option value="5">Quintuplets</option>
              <option value="4">16th notes</option>
              <option value="3">Triplets</option>
              <option value="2">8th notes</option>
            </select>
            <StepButtons val={subDivs} setter={setSubDivs} min={2} max={8} />

            <SwingField>
              <label onClick={() => setSwing(0)}>Swing: {swing}%</label>{' '}
              <Range
                min={0}
                max={99}
                step={1}
                value={swing}
                onChange={e => {
                  setSwing(int(e.target.value));
                }}
                disabled={subDivs % 2 > 0}
                debounceTimeout={0}
              />
              <StepButtons
                val={swing}
                setter={setSwing}
                min={0}
                max={99}
                disabled={subDivs % 2 > 0}
              />
            </SwingField>
          </>
        )}
      </PlaySubDivsField>

      {visualizers.map((id, idx) => (
        <VisualizerField key={`v-${idx}`}>
          <DefaultVisualizer id={id} metronome={m} />
        </VisualizerField>
      ))}

      <div>
        {!started ? (
          <StartButton
            onClick={e => {
              e.preventDefault();
              start();
            }}
          >
            Start
          </StartButton>
        ) : (
          <StopButton
            onClick={e => {
              e.preventDefault();
              stop();
            }}
          >
            Stop
          </StopButton>
        )}
      </div>
    </Layout>
  );
}

const BPMArea = ({ clicker, onChange }) => {
  const [bpm, setBpm] = useSetting('bpm', bpmDefault, float);
  const [editingBPM, setEditingBPM] = useState(false);
  const { bpm: tappedBPM, handleTap } = useTapBPM(bpm);
  const bpmRef = useRef();

  useEffect(() => {
    setBpm(validBpm(float(tappedBPM) || bpm));
  }, [tappedBPM]);

  useEffect(() => {
    onChange?.(bpm);
  }, [bpm]);

  useKeypress('t', () => {
    // t: tap
    handleTap();
    clicker?.click();
  });

  useEffect(() => {
    if (editingBPM && bpmRef.current) {
      bpmRef.current.value = bpm;
      bpmRef.current.focus();
      bpmRef.current.select();
    }
  }, [editingBPM]);

  return (
    <BPMField editing={editingBPM}>
      <TapButton onClick={e => handleTap(e)} onMouseDown={() => clicker.click()}>
        Tap
      </TapButton>

      <input
        ref={bpmRef}
        type="number"
        min={bpmMin}
        max={bpmMax}
        defaultValue={bpm}
        size={5}
        onBlur={e => {
          setBpm(validBpm(float(e.target.value) || bpm));
          setEditingBPM(false);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            setBpm(validBpm(float(e.target.value) || bpm));
            setEditingBPM(false);
          }
        }}
        onChange={() => {}}
      />
      <label onClick={() => setEditingBPM(true)}>{bpm} BPM</label>

      <StepButtons val={bpm} setter={setBpm} min={20} max={300} conv={float} />
      <br />

      <div>
        <Range
          min={bpmMin}
          max={bpmMax}
          step={1}
          value={bpm}
          onChange={e => setBpm(float(e.target.value))}
          debounceTimeout={0}
          ticks={[40, 80, 120, 160, 200, 240, bpmMax]}
        />
      </div>
    </BPMField>
  );
};

const StepButtons = ({ val, setter, min, max, step = 1, conv = int, disabled = false }) => {
  return (
    <>
      <StepButton
        disabled={disabled || val === max}
        onClick={() => setter(x => (x < max ? conv(x) + step : x))}
      >
        +
      </StepButton>
      <StepButton
        disabled={disabled || val === min}
        onClick={() => setter(x => (x > min ? conv(x) - step : x))}
      >
        -
      </StepButton>
    </>
  );
};

export default App;
