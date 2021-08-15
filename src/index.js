import React from 'react';
import ReactDOM from 'react-dom';
import { SpeechProvider } from '@speechly/react-client';
import App from './App';
import About from './About';

import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';

ReactDOM.render(
  <React.StrictMode>
    <Router>
      <Switch>
        <Route exact path="/">
          {process.env.REACT_APP_SPEECHLY_API_KEY ? (
            <SpeechProvider appId={process.env.REACT_APP_SPEECHLY_API_KEY} language="en-US">
              <App />
            </SpeechProvider>
          ) : (
            <App />
          )}
        </Route>
        <Route path="/about">
          <About />
        </Route>
      </Switch>
    </Router>
  </React.StrictMode>,
  document.getElementById('root'),
);
