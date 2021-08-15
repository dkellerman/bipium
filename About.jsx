import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { AboutPage } from './App.styles';

const ABOUT = `
## About Bipium
Bipium is a metronome.

Click start.

## Features
- BPM slider, or type it in (allows fractional beats)
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
      <ReactMarkdown source={ABOUT}></ReactMarkdown>
    </AboutPage>
  );
}
