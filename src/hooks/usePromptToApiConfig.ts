import { useCallback, useRef, useState } from 'react';
import { seedDrumLoopPattern } from '@/core/index';
import type { ApiConfig, RuntimeApi } from '@/types';

interface UsePromptToApiConfigOptions {
  onPayloadReady: (prettyPayload: string) => void;
  onStatusChange: (status: string) => void;
}

const LLM_DEBUG_ENABLED =
  import.meta.env.DEV ||
  ((import.meta.env.VITE_LLM_DEBUG as string | undefined)?.toLowerCase() ?? '') === 'true';

function llmDebug(message: string, data?: unknown) {
  if (!LLM_DEBUG_ENABLED) return;
  if (data === undefined) {
    console.debug(`[llm] ${message}`);
    return;
  }
  console.debug(`[llm] ${message}`, data);
}

async function requestPayloadFromServer(params: {
  prompt: string;
  docsMarkdown: string;
  runtime: RuntimeApi;
  signal?: AbortSignal;
}) {
  const payload = {
    prompt: params.prompt,
    docsMarkdown: params.docsMarkdown,
    currentConfig: params.runtime.getConfig(),
    soundPacks: params.runtime.getSoundPacks(),
    schema: params.runtime.getSchemaJson().config as object,
  };

  llmDebug('config: request', {
    promptChars: params.prompt.length,
    docsChars: params.docsMarkdown.length,
    soundPacks: payload.soundPacks,
  });

  const response = await fetch('/api/ai-config', {
    method: 'POST',
    signal: params.signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
    const message = errorBody?.error ?? `LLM request failed (${response.status}).`;
    llmDebug('config: error body', { status: response.status, message });
    throw new Error(message);
  }

  const data = (await response.json()) as unknown;
  llmDebug('config: output', data);
  return data;
}

function shouldUseLoopMode(config: ApiConfig) {
  const activeSubDivs = config.playSubDivs ? config.subDivs : 1;
  const swing = config.playSubDivs && config.subDivs % 2 === 0 ? config.swing : 0;
  const seededPattern = seedDrumLoopPattern({ beats: config.beats, subDivs: activeSubDivs, swing });

  return JSON.stringify(config.loopPattern) !== JSON.stringify(seededPattern);
}

function normalizeLoopConfig(config: ApiConfig): ApiConfig {
  const loopMode = shouldUseLoopMode(config);
  if (loopMode) {
    return {
      ...config,
      loopMode: true,
    };
  }

  const activeSubDivs = config.playSubDivs ? config.subDivs : 1;
  const swing = config.playSubDivs && config.subDivs % 2 === 0 ? config.swing : 0;

  return {
    ...config,
    loopMode: false,
    loopPattern: seedDrumLoopPattern({
      beats: config.beats,
      subDivs: activeSubDivs,
      swing,
    }),
  };
}

function waitForAnimationFrame() {
  return new Promise<void>(resolve => {
    window.requestAnimationFrame(() => resolve());
  });
}

export function usePromptToApiConfig({
  onPayloadReady,
  onStatusChange,
}: UsePromptToApiConfigOptions) {
  const [llmGenerating, setLlmGenerating] = useState(false);
  const activeRequestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | undefined>(undefined);

  const cancelPromptGeneration = useCallback(() => {
    activeRequestIdRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = undefined;
    }
    setLlmGenerating(false);
  }, []);

  const generateAndRunFromPrompt = useCallback(
    async (rawPrompt: string) => {
      const prompt = rawPrompt.trim();
      if (!prompt) {
        onStatusChange('Enter a prompt first.');
        return false;
      }

      const runtime = window.bpm;
      if (!runtime) {
        console.warn('AI prompt aborted: window.bpm is not available yet.');
        onStatusChange('window.bpm is not available yet.');
        return false;
      }

      cancelPromptGeneration();
      setLlmGenerating(true);
      const requestId = activeRequestIdRef.current + 1;
      activeRequestIdRef.current = requestId;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const docsResponse = await fetch('/api.md', { signal: controller.signal });
        const docsMarkdown = docsResponse.ok ? await docsResponse.text() : '';

        onStatusChange('Generating runtime config...');
        const parsedRaw = await requestPayloadFromServer({
          prompt,
          docsMarkdown,
          runtime,
          signal: controller.signal,
        });

        if (requestId !== activeRequestIdRef.current) return false;

        const validation = runtime.validateConfig(parsedRaw);
        if (!validation.ok) {
          throw new Error(
            `Validation failed: ${'error' in validation ? validation.error : 'Invalid config.'}`,
          );
        }

        const normalizedConfig = normalizeLoopConfig(validation.value);
        const pretty = JSON.stringify(normalizedConfig, null, 2);
        runtime.stop();
        runtime.setConfig(normalizedConfig);
        await waitForAnimationFrame();
        await waitForAnimationFrame();
        if (requestId !== activeRequestIdRef.current) return false;
        runtime.start();
        onPayloadReady(pretty);
        onStatusChange('Started generated config.');
        return true;
      } catch (error) {
        if (requestId !== activeRequestIdRef.current) return false;
        if (error instanceof Error && error.name === 'AbortError') {
          onStatusChange('Prompt canceled.');
          return false;
        }
        const message = error instanceof Error ? error.message : 'Unknown LLM error.';
        onStatusChange(`LLM error: ${message}`);
        console.error(error);
        return false;
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setLlmGenerating(false);
          abortControllerRef.current = undefined;
        }
      }
    },
    [cancelPromptGeneration, onPayloadReady, onStatusChange],
  );

  return {
    llmGenerating,
    generateAndRunFromPrompt,
    cancelPromptGeneration,
  };
}
