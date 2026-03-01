import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { ClickerInstance, MetronomeInstance, StateSetter } from '@/types';

export interface AppContextValue {
  buildSha: string;
  bpm: number;
  beats: number;
  subDivs: number;
  playSubDivs: boolean;
  swing: number;
  swingEnabled: boolean;
  volume: number;
  muted: boolean;
  soundPack: string;
  started: boolean;
  showSideBar: boolean;
  copiedURL: string | null;
  visualizers: string[];
  visualizerWidth: number;
  visualizerHeight: number;
  clicker: ClickerInstance;
  metronome: MetronomeInstance;
  setStarted: StateSetter<boolean>;
  setBeats: StateSetter<number>;
  setSubDivs: StateSetter<number>;
  setSwing: StateSetter<number>;
  setVolume: StateSetter<number>;
  setMuted: StateSetter<boolean>;
  setSoundPack: StateSetter<string>;
  setShowSideBar: StateSetter<boolean>;
  setPlaySubDivsWithTracking: (value: boolean) => void;
  setSwingEnabledWithRestore: (value: boolean) => void;
  copyConfigurationURL: () => void;
  updateBPM: (value: number) => void;
}

export interface AppProviderProps {
  value: AppContextValue;
  children?: ReactNode;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ value, children }: AppProviderProps) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider.');
  }
  return context;
}
