import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import About from './About';
import './index.css';

ReactDOM.render(
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
  document.getElementById('root') as Element,
);
