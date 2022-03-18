import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { AboutPage } from './App.styles';

const ABOUT = `
## About Bipium
Bipium is a free metronome on the web. It includes classic metronome features
such as tap tempo, sub divisions, visualization, and now swing!

__To use__: click start.

## Features
- Counts to 4, repeats
- BPM slider, or type it in (allows fractional beats)
- Set number of beats per measure
- Tap tempo
- Play sub-divisions if desired
- Swing!
- Tap along, shows feedback for early/late clicks
- Visualization vaguely imitates a piano roll
- Set volume

## Info
- Written by David Kellerman
- Code available on [Github](https://github.com/dkellerman/bipium)
- [Here's a rhymes dicionary based on actual songs](https://rhymes.now.sh)
`;

export default function About() {
  return (
    <AboutPage>
      <Link to="/">Back to app</Link>
      <ReactMarkdown children={ABOUT}></ReactMarkdown>
    </AboutPage>
  );
}
