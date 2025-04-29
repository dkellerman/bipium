import React from 'react';
import { Link } from 'react-router-dom';
import { Nav } from './App.styles';

export const NavBar = ({ children }) => (
  <Nav>
    <h3>
      <Link to="/">
        <span className="bipium">Bipium</span>
      </Link>
    </h3>
    {children}
  </Nav>
);
