import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SOUND_PACKS } from '@/hooks';
import { useApp } from '@/context/AppContext';
import { sendEvent } from '@/tracking';
import { VolumeControl } from './VolumeControl';

export function SettingsDrawer() {
  const {
    buildSha,
    showSideBar,
    setShowSideBar,
    soundPack,
    setSoundPack,
    copiedURL,
    copyConfigurationURL,
  } = useApp();

  return (
    <Sheet open={showSideBar} onOpenChange={setShowSideBar}>
      <SheetContent
        side="right"
        className={
          'w-[320px] border-l border-slate-300 bg-slate-50 px-5 pt-12 text-[15px] sm:w-[320px]'
        }
      >
        <SheetHeader>
          <SheetTitle className="text-[17.6px]">Settings</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <p className="font-medium">Volume</p>
            <VolumeControl compact />
          </div>

          <div className="space-y-2">
            <label className="font-medium">Sounds</label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none"
              value={soundPack}
              onChange={event => {
                setSoundPack(event.target.value);
                sendEvent('set_sound_pack', 'App', event.target.value);
              }}
            >
              {Object.keys(SOUND_PACKS).map((key, index) => (
                <option key={`sp-${index + 1}`} value={key}>
                  {typeof SOUND_PACKS[key]?.name === 'string' ||
                  typeof SOUND_PACKS[key]?.name === 'number'
                    ? SOUND_PACKS[key]?.name
                    : key}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col items-start gap-2">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-[15px]"
              onClick={event => {
                event.preventDefault();
                sendEvent('reset');
                window.location.replace('/?reset');
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
            <Link className="block underline" to="/api">
              API
            </Link>
            {buildSha && <p className="text-xs text-slate-500">Build: {buildSha.substring(1, 5)}</p>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
