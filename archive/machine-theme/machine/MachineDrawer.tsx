/*
 * Machine UI — slide-out menu for the /machine route. Slimmed copy of
 * components/SettingsDrawer with volume, theme, links, and actions.
 */
import { VolumeControl } from '@/components/VolumeControl';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useApp } from '@/AppContext';
import { storeTheme, type UITheme } from '@/lib/theme';
import { sendEvent } from '@/tracking';

export function MachineDrawer() {
  const { buildSha, showSideBar, setShowSideBar, copiedURL, copyConfigurationURL } = useApp();

  return (
    <Sheet open={showSideBar} onOpenChange={setShowSideBar}>
      <SheetContent
        side="right"
        className={
          'w-[320px] border-l border-slate-300 bg-slate-50 px-5 pt-12 text-px-15 sm:w-[320px]'
        }
      >
        <div className="mt-2 space-y-6">
          <div className="space-y-2">
            <p className="font-medium">Volume</p>
            <VolumeControl compact />
          </div>
          <div className="space-y-2">
            <label className="font-medium">Theme</label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none"
              value="machine"
              onChange={event => {
                const theme = event.target.value as UITheme;
                storeTheme(theme);
                sendEvent('set_theme', 'App', theme);
                if (theme !== 'machine') window.location.assign('/');
              }}
            >
              <option value="classic">Classic</option>
              <option value="machine">Machine</option>
            </select>
          </div>

          <div className="flex flex-col items-start gap-2">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-px-15"
              onClick={event => {
                event.preventDefault();
                sendEvent('reset');
                window.location.replace(`${window.location.pathname}?reset`);
              }}
            >
              Reset all settings
            </Button>

            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-px-15"
              onClick={event => {
                event.preventDefault();
                copyConfigurationURL();
                sendEvent('copy_configuration_url');
              }}
            >
              Copy configuration URL
            </Button>

            {copiedURL && (
              <p className="text-px-13 text-slate-600">
                Copied{' '}
                <a className="underline" href={copiedURL} target="_blank" rel="noreferrer">
                  configuration URL
                </a>{' '}
                to clipboard.
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-1.5 text-px-15">
            <Link className="underline" to="/about">
              About
            </Link>
            <a
              className="block underline"
              href="https://github.com/dkellerman/bipium"
              target="_blank"
              rel="noreferrer"
              onClick={() => sendEvent('code')}
            >
              Code
            </a>
            <Link className="block underline" to="/apidocs">
              API
            </Link>
            {buildSha && (
              <p className="text-xs text-slate-500">Build: {buildSha.substring(1, 5)}</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
