import { Link } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { PHONE_BEZEL, PHONE_WIDTH, phoneFramed } from '@/lib/phone-frame';
import { cn } from '@/lib/utils';
import { SOUND_PACKS } from '@/hooks';
import { useApp } from '@/AppContext';
import { setColorMode, useColorMode, type ColorMode } from '@/lib/color-mode';
import { storeTheme, type UITheme } from '@/lib/theme';
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
  const colorMode = useColorMode();
  // On desktop it fills the window beside the phone, from the window's right edge to a
  // margin off the phone's; on phones it drops down from under the header.
  const framed = phoneFramed();

  return (
    <Sheet open={showSideBar} onOpenChange={setShowSideBar}>
      <SheetContent
        side="right"
        anchor={framed ? undefined : 'nav[data-navbar]'}
        overlayClassName={
          framed
            ? 'bg-transparent duration-300 ease-out'
            : 'bg-white/70 duration-300 ease-out dark:bg-slate-950/70'
        }
        style={
          framed
            ? { width: `calc(50vw - ${PHONE_WIDTH / 2 + PHONE_BEZEL + DESKTOP_MARGIN}px)` }
            : undefined
        }
        className={cn(
          !framed && 'w-[85vw] max-w-[375px]',
          'overflow-y-auto border-slate-200 dark:border-slate-700 bg-[#edf3f9]/85 bg-none p-5 dark:bg-[#141e2e]/85',
          'text-slate-900 dark:text-slate-100 shadow-lg backdrop-blur duration-300 ease-out',
        )}
      >
        <nav className="flex flex-col gap-4 text-xl">
          <Link className={menuLink} to="/about">
            About
          </Link>
          <Link className={menuLink} to="/apidocs">
            API
          </Link>
          <a
            className={menuLink}
            href="https://github.com/dkellerman/bipium"
            target="_blank"
            rel="noreferrer"
            onClick={() => sendEvent('code')}
          >
            Code
          </a>
        </nav>

        <div className={section}>
          <p className={sectionLabel}>Volume</p>
          <VolumeControl compact />
        </div>

        <div className={section}>
          <label className={sectionLabel} htmlFor="menu-sounds">
            Sounds
          </label>
          <select
            id="menu-sounds"
            className={menuSelect}
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

        <div className={section}>
          <label className={sectionLabel} htmlFor="menu-theme">
            Theme
          </label>
          <select
            id="menu-theme"
            className={menuSelect}
            value="classic"
            onChange={event => {
              const theme = event.target.value as UITheme;
              storeTheme(theme);
              sendEvent('set_theme', 'App', theme);
              if (theme !== 'classic') window.location.assign('/');
            }}
          >
            <option value="classic">Classic</option>
            <option value="machine">Machine</option>
          </select>
        </div>

        <div className={section}>
          <label className={sectionLabel} htmlFor="menu-appearance">
            Appearance
          </label>
          <select
            id="menu-appearance"
            className={menuSelect}
            value={colorMode}
            onChange={event => {
              const mode = event.target.value as ColorMode;
              setColorMode(mode);
              sendEvent('set_color_mode', 'App', mode);
            }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className={cn(section, 'flex flex-col items-start gap-2 text-px-15')}>
          <button
            type="button"
            className={menuLink}
            onClick={event => {
              event.preventDefault();
              copyConfigurationURL();
              sendEvent('copy_configuration_url');
            }}
          >
            Copy configuration URL
          </button>
          {copiedURL && (
            <p className="text-px-13 text-slate-600 dark:text-slate-400">
              Copied{' '}
              <a className="underline" href={copiedURL} target="_blank" rel="noreferrer">
                configuration URL
              </a>{' '}
              to clipboard.
            </p>
          )}
          <button
            type="button"
            className={menuLink}
            onClick={event => {
              event.preventDefault();
              sendEvent('reset');
              window.location.replace('/?reset');
            }}
          >
            Reset all settings
          </button>
          {buildSha && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Build: {buildSha.substring(1, 5)}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const DESKTOP_MARGIN = 24; // between the phone and the menu, on desktop
const menuLink = 'cursor-pointer text-slate-900 dark:text-slate-100 no-underline hover:underline';
const section = 'mt-6 border-t border-slate-200 dark:border-slate-700 pt-4';
const sectionLabel =
  'mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400';
const menuSelect =
  'h-9 w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm outline-none focus:ring-2 focus:ring-sky-400';
