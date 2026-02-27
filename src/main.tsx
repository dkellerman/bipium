import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import About from './About';
import './index.css';

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Router>
        <div className="min-h-dvh bg-white" style={{ touchAction: 'pan-y pinch-zoom' }}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </div>
      </Router>
    </React.StrictMode>,
  );
}
