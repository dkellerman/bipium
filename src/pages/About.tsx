import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
`;

export default function About() {
  return (
    <main
      className={cn(
        'mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-3 bg-white px-3 py-4 text-slate-900',
        'shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
      )}
    >
      <div>
        <Link className={buttonVariants({ variant: 'outline' })} to="/">
          Back to app
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          <ReactMarkdown
            components={{
              h2: ({ children, ...props }) => (
                <h2 className="mt-4 text-xl font-semibold first:mt-0" {...props}>
                  {children}
                </h2>
              ),
              p: ({ children, ...props }) => (
                <p className="mt-2 text-base leading-relaxed text-slate-700" {...props}>
                  {children}
                </p>
              ),
              ul: ({ children, ...props }) => (
                <ul className="mt-2 list-disc space-y-1 pl-6" {...props}>
                  {children}
                </ul>
              ),
              li: ({ children, ...props }) => (
                <li className="text-slate-700" {...props}>
                  {children}
                </li>
              ),
              a: ({ children, ...props }) => (
                <a className="underline underline-offset-2" {...props}>
                  {children}
                </a>
              ),
              strong: ({ children, ...props }) => (
                <strong className="font-semibold text-slate-900" {...props}>
                  {children}
                </strong>
              ),
            }}
          >
            {ABOUT}
          </ReactMarkdown>
        </CardContent>
      </Card>
    </main>
  );
}
