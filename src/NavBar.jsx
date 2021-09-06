import { Nav } from './App.styles';

export const NavBar = () => {
  return (
    <Nav className="split-nav">
      <h3>
        <a href="/about">
          <span className="bipium">B</span>
          <span>i</span>
          <span className="bipium">p</span>
          <span>i</span>
          <span>u</span>
          <span className="bipium">m</span>
        </a>
      </h3>
    </Nav>
  );
};
