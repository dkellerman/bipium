/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import qs from 'query-string';
import copyToClipboard from 'copy-to-clipboard';
import useKeypress from 'react-use-keypress';
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
  VolumeSliderSide,
  VolumeSliderMain,
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
import { sendEvent, sendOneEvent, sendFrameRate } from './tracking';

const int = x => x && parseInt(x, 10);
const float = x => x && parseFloat(x);
const bool = x => (x && [true, 1, '1', 'true', 't'].includes(x)) || false;

const bpmMin = 20.0;
const bpmMax = 320.0;
const bpmDefault = 80.0;
const validBpm = val => Math.max(Math.min(bpmMax, val || bpmDefault), bpmMin);

function App() {
  const bpm = useRef();
  const [beats, setBeats] = useSetting('beats', 4, int);
  const [subDivs, setSubDivs] = useSetting('subDivs', 1, int);
  const [swing, setSwing] = useSetting('swing', 0, int);
  const [playSubDivs, setPlaySubDivs] = useSetting('playSubDivs', true, bool);
  const [volume, setVolume] = useSetting('volume', 35, int, localStorage);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);
  const [soundPack, setSoundPack] = useSetting('soundPack', 'drumkit', String);
  const [visualizers] = useSetting('visualizers', 'default', val => val.split(','));

  const [showSideBar, setShowSideBar] = useState(false);
  const [copiedURL, setCopiedURL] = useState(null);
  const [, _update] = useState(false);
  const forceRender = () => _update(x => !x);

  // single shared audio context
  const audioContext = useRef(new AudioContext());

  const canSwing = subDivs % 2 === 0;

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
    swing: playSubDivs && canSwing ? swing : 0,
    workerUrl: '/dist/worker.min.js',
  });

  const start = useCallback(() => {
    setStarted(true);
  }, []);

  const stop = useCallback(() => {
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
      swing: playSubDivs && canSwing ? swing : 0,
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
      sendFrameRate();
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
      <NavBar>
        {showSideBar ? (
          <CloseIcon showSideBar={showSideBar} onClick={() => setShowSideBar(false)} />
        ) : (
          <SettingsIcon showSideBar={showSideBar} onClick={() => setShowSideBar(true)} />
        )}
      </NavBar>

      {showSideBar && (
        <SideBar show={showSideBar}>
          <ul>
            <li>
              <VolumeSliderSide>
                <VolumeIcon
                  muted={muted}
                  onClick={() => {
                    setMuted(val => !val);
                    sendOneEvent(`set_mute_${muted ? 'off' : 'on'}`);
                  }}
                />
                <Range
                  min={0}
                  max={100}
                  step={1}
                  value={volume}
                  onDrag={val => {
                    setVolume(int(val));
                    sendOneEvent('set_volume', '', val, int(val));
                  }}
                />
              </VolumeSliderSide>
            </li>

            <li>
              <SoundPack>
                <label>Sounds:</label>{' '}
                <select
                  value={soundPack}
                  onChange={e => {
                    setSoundPack(e.target.value);
                    sendEvent('set_sound_pack', 'App', e.target.value);
                  }}
                >
                  {Object.keys(SOUND_PACKS).map((key, idx) => (
                    <option key={`sp-${idx + 1}`} value={key}>
                      {SOUND_PACKS[key]?.name}
                    </option>
                  ))}
                </select>
              </SoundPack>
            </li>

            <li>
              <ButtonAsLink
                onClick={e => {
                  e.preventDefault();
                  sendEvent('reset');
                  window.location.replace(`/?reset`);
                }}
              >
                Reset all settings
              </ButtonAsLink>
            </li>

            <li>
              <ButtonAsLink
                onClick={e => {
                  e.preventDefault();
                  copyConfigurationURL();
                  sendEvent('copy_configuration_url');
                }}
              >
                Copy configuration URL
              </ButtonAsLink>

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
            </li>

            <li>
              <Divider />
            </li>

            <li>
              <Link to="/about">About</Link>
            </li>

            <li>
              <a
                href="https://github.com/dkellerman/bipium"
                target="_blank"
                rel="noreferrer"
                onClick={() => sendEvent('code')}
              >
                Code
              </a>
            </li>

            {process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA && (
              <li>
                <small>
                  Build: {(process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA || '').substring(1, 5)}
                </small>
              </li>
            )}
          </ul>
        </SideBar>
      )}

      <BPMArea
        clicker={clicker}
        onChange={val => {
          updateBPM(val);
          sendEvent('set_bpm', 'App', val, float(val));
        }}
      />

      <BeatsField>
        <label>Beats:</label>{' '}
        <select
          value={beats}
          onChange={e => {
            const val = int(e.target.value);
            setBeats(val);
            sendEvent('set_beats', 'App', val, val);
          }}
        >
          {new Array(12).fill(0).map((_, idx) => (
            <option key={`beats-${idx + 1}`} value={idx + 1}>
              {idx + 1}
            </option>
          ))}
        </select>
        <StepButtons val={beats} setter={setBeats} min={1} max={12} event="set_beats" />
      </BeatsField>

      <PlaySubDivsField>
        <input
          type="checkbox"
          checked={playSubDivs}
          onChange={e => {
            const val = e.target.checked;
            setPlaySubDivs(val);
            sendEvent('set_play_subdivs', 'App', val, val ? 1 : 0);
          }}
        />
        <label>Play{playSubDivs ? ':' : ' sub divs'}</label>

        {playSubDivs && (
          <>
            <select
              value={subDivs}
              onChange={e => {
                const val = int(e.target.value);
                setSubDivs(val);
                sendEvent('set_subdivs', 'App', val, val);
              }}
            >
              <option value="8">32nd notes</option>
              <option value="7">Septuplets</option>
              <option value="6">Sextuplets</option>
              <option value="5">Quintuplets</option>
              <option value="4">16th notes</option>
              <option value="3">Triplets</option>
              <option value="2">8th notes</option>
              <option value="1">Quarter notes</option>
            </select>
            <StepButtons val={subDivs} setter={setSubDivs} min={1} max={8} event="set_subdivs" />

            <SwingField disabled={!canSwing}>
              <label>
                <span>Swing:</span> <span>{canSwing ? swing : 0}%</span>
              </label>{' '}
              <Range
                min={0}
                max={99}
                step={1}
                value={canSwing ? swing : 0}
                onDrag={val => {
                  setSwing(int(val));
                  sendOneEvent('update_swing', '', val, int(val));
                }}
                disabled={!canSwing}
                ticks={[0, 33, 50]}
              />
              <StepButtons
                val={swing}
                setter={setSwing}
                min={0}
                max={99}
                disabled={!canSwing}
                event="set_swing"
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
              sendEvent('start');
            }}
          >
            Start
          </StartButton>
        ) : (
          <StopButton
            onClick={e => {
              e.preventDefault();
              stop();
              sendEvent('stop');
            }}
          >
            Stop
          </StopButton>
        )}
      </div>

      <VolumeSliderMain>
        <VolumeIcon
          muted={muted}
          onClick={() => {
            setMuted(val => !val);
            sendOneEvent(`mute_${muted ? 'off' : 'on'}`);
          }}
        />

        <Range
          min={0}
          max={100}
          step={1}
          value={volume}
          onDrag={val => {
            setVolume(int(val));
            sendOneEvent('set_volume', '', val, int(val));
          }}
        />
      </VolumeSliderMain>
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
    sendOneEvent('tap');
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
      <TapButton
        onClick={e => handleTap(e)}
        onMouseDown={() => {
          clicker.click();
          sendOneEvent('tap');
        }}
      >
        <span>T</span>ap
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
      />
      <label
        onClick={() => {
          setEditingBPM(true);
          sendEvent('edit_bpm');
        }}
      >
        {bpm} BPM
      </label>

      <StepButtons val={bpm} setter={setBpm} min={20} max={300} conv={float} />

      <div>
        <Range
          min={bpmMin}
          max={bpmMax}
          step={1}
          value={bpm}
          onDrag={val => {
            setBpm(validBpm(val));
          }}
          labelRotation={-60}
          ticks={[50, 80, 100, 120, 140, 160, 180, 200, 220, 240, bpmMax]}
        />
      </div>
    </BPMField>
  );
};

const StepButtons = ({
  val,
  setter,
  min,
  max,
  step = 1,
  conv = int,
  disabled = false,
  event = null,
}) => {
  return (
    <>
      <StepButton
        disabled={disabled || val === max}
        onClick={() => {
          setter(x => (x < max ? conv(x) + step : x));
          if (event) sendEvent(event, 'App', 'step_up');
        }}
      >
        +
      </StepButton>
      <StepButton
        disabled={disabled || val === min}
        onClick={() => {
          setter(x => (x > min ? conv(x) - step : x));
          if (event) sendEvent(event, 'App', 'step_down');
        }}
      >
        -
      </StepButton>
    </>
  );
};

export default App;
