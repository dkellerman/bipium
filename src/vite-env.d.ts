/// <reference types="vite/client" />

import type { RuntimeApi } from './core';

interface ImportMetaEnv {
  readonly VITE_LLM_DEBUG?: string;
}

declare global {
  interface Window {
    bpm?: RuntimeApi;
  }
}
