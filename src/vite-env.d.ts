/// <reference types="vite/client" />

import type { RuntimeApi } from './types';

interface ImportMetaEnv {
  readonly VITE_OPENAI_KEY?: string;
  readonly OPENAI_API_KEY?: string;
  readonly VITE_OPENAI_MODEL?: string;
  readonly VITE_LLM_DEBUG?: string;
}

declare global {
  interface Window {
    bpm?: RuntimeApi;
  }
}
