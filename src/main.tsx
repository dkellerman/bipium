import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from '@/pages/App';
import { getStoredTheme } from '@/lib/theme';
import About from '@/pages/About';
import ApiPage from '@/pages/ApiPage';
import MachinePage from '@/machine/MachinePage';
import './index.css';

/* The site root serves the stored theme; /machine renders the machine theme
   directly — the URL overrides the stored choice and nothing else. */
function ThemedRoot() {
  return getStoredTheme() === 'machine' ? <MachinePage /> : <App />;
}

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Router>
        <div
          className="min-h-dvh bg-linear-to-b from-[#f8fbff] via-[#eef6ff] to-[#f8fbff]"
          style={{ touchAction: 'pan-y pinch-zoom' }}
        >
          <Routes>
            <Route path="/" element={<ThemedRoot />} />
            <Route path="/machine" element={<MachinePage />} />
            <Route path="/apidocs" element={<ApiPage />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </div>
      </Router>
    </React.StrictMode>,
  );
}
