/// <reference types="vite/client" />

import type { RuntimeApi } from './types';

declare global {
  interface Window {
    bpm?: RuntimeApi;
  }
}
