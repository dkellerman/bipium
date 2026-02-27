/// <reference types="vite/client" />

import type { BipiumRuntimeApi } from './types';

declare global {
  interface Window {
    bpm?: BipiumRuntimeApi;
  }
}
