import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import About from './About';
import ApiPage from './ApiPage';
import './index.css';

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Router>
        <div
          className="min-h-dvh bg-gradient-to-b from-[#f8fbff] via-[#eef6ff] to-[#f8fbff]"
          style={{ touchAction: 'pan-y pinch-zoom' }}
        >
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/api" element={<ApiPage />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </div>
      </Router>
    </React.StrictMode>,
  );
}
