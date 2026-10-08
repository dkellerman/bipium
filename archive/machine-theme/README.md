# Old machine theme (not used)

This is the old theme switch and the "machine" interface (the hardware drum machine
look that used to be at `/machine`). It was retired on 2026-10-07 and is **not currently
used**: nothing imports it, and it isn't type-checked, tested or built. The classic
interface is the only one now.

- `machine/`: the machine interface (`MachinePage`, `Machine`, `MachineDrawer`,
  `DrumLaneLabels`, `shared`, `machine.css`), and its own README.
- `theme.ts`: the stored theme choice (`uiTheme` in localStorage) that let `/` serve
  either interface.

Other code that held machine/theme pieces and was cleaned up when the theme was retired:

- `src/main.tsx`: the `/machine` route, and `/` picking the stored theme.
- `src/components/SettingsDrawer.tsx`: the Theme menu.
- `src/components/ListenControl.tsx`, `VoiceIntro.tsx`, `TunerPopup.tsx`: a `machine`
  variant with its own styling.
- `src/components/DefaultVisualizer.tsx`: the `skipEdgeGridLines` prop (machine only).
- `src/components/PhoneFrame.tsx`, `src/lib/phone-frame.ts`: the machine page background
  and framing on `/machine`.
- `index.html`, `src/lib/color-mode.tsx`: dark mode skipped the machine page.
- `server/index.mjs`: `/machine` was an app route; it now redirects to `/`.

The commit before the removal (`4358554`) has all of it wired up, if it's ever wanted
again.
