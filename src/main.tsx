import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from '@/pages/App';
import About from '@/pages/About';
import ApiPage from '@/pages/ApiPage';
import { PhoneFrame } from '@/components/PhoneFrame';
import { phoneFramed } from '@/lib/phone-frame';
import { preferPlayback } from '@/lib/audio-session';
import { ColorModeScope } from '@/lib/color-mode';
import './index.css';

// Every visit saves the current volume, so a saved 35 or 100 is an old default (35%, then
// 100%, which was too loud). Once, move it to the 50% default.
try {
  if (!localStorage.getItem('volumeDefault50')) {
    if (['35', '100'].includes(localStorage.getItem('volume') ?? ''))
      localStorage.setItem('volume', '50');
    localStorage.setItem('volumeDefault50', '1');
  }
} catch {}

// A metronome is media: play through the silent switch, on the speaker (see audio-session).
preferPlayback();

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);
  const app = (
    <Router>
      <div
        // Framed, the page background is drawn once around the phone (see PhoneFrame).
        className={
          phoneFramed()
            ? 'min-h-dvh'
            : 'min-h-dvh bg-linear-to-b from-[#f8fbff] via-[#eef6ff] to-[#f8fbff] dark:from-[#03060b] dark:via-[#060b14] dark:to-[#03060b]'
        }
        style={{ touchAction: 'pan-y pinch-zoom' }}
      >
        <Routes>
          <Route
            path="/"
            element={
              <ColorModeScope>
                <App />
              </ColorModeScope>
            }
          />
          <Route
            path="/apidocs"
            element={
              <ColorModeScope>
                <ApiPage />
              </ColorModeScope>
            }
          />
          <Route
            path="/about"
            element={
              <ColorModeScope>
                <About />
              </ColorModeScope>
            }
          />
        </Routes>
      </div>
    </Router>
  );
  // On desktop the player is styled as a phone (see PhoneFrame).
  root.render(
    <React.StrictMode>{phoneFramed() ? <PhoneFrame>{app}</PhoneFrame> : app}</React.StrictMode>,
  );
}
