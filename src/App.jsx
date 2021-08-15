/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import qs from 'query-string';
import copyToClipboard from 'copy-to-clipboard';
import useKeypress from 'react-use-keypress';
import { Link } from 'react-router-dom';
import localStorage from 'local-storage-fallback';
import { AudioContext } from 'standardized-audio-context';
import { useSpeechContext } from '@speechly/react-client';
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
  ListenButton,
  BPMField,
  BeatsField,
  PlaySubDivsField,
  SwingField,
} from './App.styles';
import { DefaultVisualizer } from './DefaultVisualizer';
import { useTapBPM, useSetting, useClicker, useMetronome, SOUND_PACKS } from './hooks';
import { NavBar } from './NavBar';

const int = x => (x ?? x) && parseInt(x, 10);
const float = x => (x ?? x) && parseFloat(x);
const bool = x => (x ?? x) && [true, 1, '1', 'true', 't'].includes(x);

function App() {
  const [bpm, setBpm] = useSetting('bpm', 80.0, float);
  const [beats, setBeats] = useSetting('beats', 4, int);
  const [subDivs, setSubDivs] = useSetting('subDivs', 4, int);
  const [swing, setSwing] = useSetting('swing', 0, int);
  const [playSubDivs, setPlaySubDivs] = useSetting('playSubDivs', false, bool);
  const [volume, setVolume] = useSetting('volume', 100, int, localStorage);
  const [started, setStarted] = useState(false);
  const [soundPack, setSoundPack] = useSetting('soundPack', 'defaults', String);
  const [visualizers] = useSetting('visualizers', 'default', val => val.split(','));

  const { bpm: tappedBPM, handleTap } = useTapBPM(bpm);
  const bpmRef = useRef();

  const [muted, setMuted] = useState(false);
  const [editingBPM, setEditingBPM] = useState(false);
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
    bpm,
    beats,
    subDivs: playSubDivs ? subDivs : 1,
    swing: playSubDivs && subDivs % 2 === 0 ? swing : 0,
    workerUrl: '/worker.js',
  });

  const { speechState, segment, toggleRecording } = useSpeechContext();

  const initAudio = () => {
    if (audioContext.current.state === 'suspended') audioContext.current.resume();
  };

  const start = () => {
    initAudio();
    setStarted(true);
  };

  const stop = () => {
    setStarted(false);
  };

  const toggle = () => {
    initAudio();
    setStarted(s => !s);
  };

  useEffect(() => {
    if (window.location.search.indexOf('?reset') === 0) window.location.replace(`/`);
  }, []);

  // update metronome on the fly when parameters change
  useEffect(() => {
    m.update({
      subDivs: playSubDivs ? subDivs : 1,
      swing: playSubDivs && subDivs % 2 === 0 ? swing : 0,
      beats,
      bpm,
    });
    forceRender();
  }, [playSubDivs, subDivs, swing, beats, bpm]);

  useEffect(() => {
    setBpm(tappedBPM);
  }, [tappedBPM]);

  useEffect(() => {
    clicker.setVolume(muted ? 0 : volume);
  }, [volume, muted]);

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

  useKeypress('t', () => {
    // t: tap
    handleTap();
    clicker.click();
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
    if (editingBPM && bpmRef.current) {
      bpmRef.current.focus();
      bpmRef.current.select();
    }
  }, [editingBPM]);

  // experimental speech handling
  useEffect(() => {
    if (segment?.isFinal) {
      console.log('=>', segment.words.map(w => w.value).join(' '));
      console.log('intent:', segment.intent.intent);
      console.log('entities:', segment.entities);

      const val = float(segment.entities?.length && segment.entities[0].value);
      switch (segment.intent.intent) {
        case 'start': {
          start();
          break;
        }
        case 'stop': {
          stop();
          break;
        }
        case 'stop_listening': {
          toggleRecording();
          break;
        }
        case 'mute': {
          setMuted(true);
          break;
        }
        case 'unumute': {
          setMuted(false);
          break;
        }
        case 'set_bpm': {
          if (val && val >= 30 && val <= 320) {
            setBpm(val);
          }
          break;
        }
        case 'increase_bpm': {
          const newBpm = bpm + (val || 5);
          if (newBpm >= 30 && newBpm <= 320) {
            setBpm(newBpm);
          }
          break;
        }
        case 'decrease_bpm': {
          const newBpm = bpm - (val || 5);
          if (newBpm >= 30 && newBpm <= 320) {
            setBpm(newBpm);
          }
          break;
        }
        case 'set_beats': {
          if (val && val >= 1 && val <= 12) {
            setBeats(val);
          }
          break;
        }
        case 'play_subdivs': {
          setPlaySubDivs(true);
          break;
        }
        case 'no_subdivs': {
          setPlaySubDivs(false);
          break;
        }
        case 'set_sub_divs': {
          if (val && val >= 2 && val <= 8) {
            setSubDivs(val);
          }
          break;
        }
        default: {
          break;
        }
      }
    }
  }, [segment]);

  useEffect(() => {
    if (showSideBar) {
      setCopiedURL(null);
    }
  }, [showSideBar]);

  const copyConfigurationURL = useCallback(() => {
    const q = { bpm, beats, playSubDivs };
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
  }, [bpm, beats, playSubDivs, soundPack]);

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
            <VolumeIcon />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              onChange={e => {
                setVolume(int(e.target.value));
              }}
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

          <div>
            Experimental: &nbsp;&nbsp;
            <ListenButton
              onClick={() => {
                initAudio();
                toggleRecording();
              }}
            >
              {speechState === 'Recording' ? 'Stop' : 'Listen'}
            </ListenButton>
            {speechState === 'Recording' && (
              <div>
                <small>
                  Try:
                  <ul>
                    <li>&#8220;Set tempo to 85&#8221;</li>
                    <li>&#8220;Start&#8221; / &#8220;Stop&#8221;</li>
                    <li>&#8220;Increase tempo&#8221;</li>
                    <li>&#8220;Mute&#8221; / &#8220;Unmute&#8221;</li>
                    <li>&#8220;Raise volume&#8221;</li>
                    <li>To end: &#8220;Stop listening&#8221;</li>
                  </ul>
                </small>
              </div>
            )}
          </div>

          <div className="divider">
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
          </div>
        </SideBar>
      )}

      <BPMField editing={editingBPM}>
        <input
          ref={bpmRef}
          type="number"
          min={20}
          max={320}
          defaultValue={bpm}
          size={5}
          onBlur={e => {
            setBpm(Math.max(Math.min(320, float(e.target.value) || bpm), 20));
            setEditingBPM(false);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              setBpm(Math.max(Math.min(320, float(e.target.value) || bpm), 20));
              setEditingBPM(false);
            }
          }}
          onChange={() => {}}
        />

        <label onClick={() => setEditingBPM(true)}>{bpm} BPM</label>

        <StepButtons val={bpm} setter={setBpm} min={20} max={300} conv={float} />
        <br />

        <input
          type="range"
          min={20}
          max={300}
          step={1}
          value={bpm}
          onChange={e => setBpm(float(e.target.value))}
        />

        <TapButton
          onClick={e => {
            handleTap(e);
            clicker.click();
          }}
        >
          Tap
        </TapButton>
      </BPMField>

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
        <label>Play sub divs</label>

        {playSubDivs && (
          <>
            <select value={subDivs} onChange={e => setSubDivs(int(e.target.value))}>
              <option value="8">32nd notes</option>
              <option value="7">7 divs</option>
              <option value="6">6 divs</option>
              <option value="5">5 divs</option>
              <option value="4">16th notes</option>
              <option value="3">Triplets</option>
              <option value="2">8th notes</option>
            </select>
            <StepButtons val={subDivs} setter={setSubDivs} min={2} max={8} />

            <SwingField>
              <label>Swing: {swing}%</label>{' '}
              <input
                type="range"
                min={0}
                max={99}
                step={1}
                value={swing}
                onChange={e => {
                  setSwing(int(e.target.value));
                }}
                disabled={subDivs % 2 > 0}
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
        <fieldset key={`v-${idx}`}>
          <DefaultVisualizer id={id} metronome={m} />
        </fieldset>
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
              setStarted(false);
            }}
          >
            Stop
          </StopButton>
        )}
      </div>
    </Layout>
  );
}

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
