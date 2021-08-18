import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import About from './About';

import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';

ReactDOM.render(
  <React.StrictMode>
    <Router>
      <Switch>
        <Route exact path="/">
          <App />
        </Route>
        <Route path="/about">
          <About />
        </Route>
      </Switch>
    </Router>
  </React.StrictMode>,
  document.getElementById('root'),
);
