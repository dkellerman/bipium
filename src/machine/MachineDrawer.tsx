/*
 * Machine UI — slide-out menu for the /machine route. Slimmed copy of
 * components/SettingsDrawer: volume and sounds live on the faceplate, so this
 * is just links and actions.
 */
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useApp } from '@/AppContext';
import { sendEvent } from '@/tracking';

export function MachineDrawer() {
  const { buildSha, showSideBar, setShowSideBar, copiedURL, copyConfigurationURL } = useApp();

  return (
    <Sheet open={showSideBar} onOpenChange={setShowSideBar}>
      <SheetContent
        side="right"
        className={
          'w-[320px] border-l border-slate-300 bg-slate-50 px-5 pt-12 text-[15px] sm:w-[320px]'
        }
      >
        <div className="mt-2 space-y-6">
          <div className="flex flex-col items-start gap-2">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-[15px]"
              onClick={event => {
                event.preventDefault();
                sendEvent('reset');
                window.location.replace('/machine?reset');
              }}
            >
              Reset all settings
            </Button>

            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-[15px]"
              onClick={event => {
                event.preventDefault();
                copyConfigurationURL();
                sendEvent('copy_configuration_url');
              }}
            >
              Copy configuration URL
            </Button>

            {copiedURL && (
              <p className="text-[13px] text-slate-600">
                Copied{' '}
                <a className="underline" href={copiedURL} target="_blank" rel="noreferrer">
                  configuration URL
                </a>{' '}
                to clipboard.
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-1.5 text-[15px]">
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
