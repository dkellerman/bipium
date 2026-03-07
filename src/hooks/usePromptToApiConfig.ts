import { useCallback, useRef, useState } from 'react';
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
}): Promise<ApiConfig> {
  const payload = {
    prompt: params.prompt,
    docsMarkdown: params.docsMarkdown,
    currentConfig: params.runtime.getConfig(),
    soundPacks: params.runtime.getSoundPacks(),
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
    const rawBody = await response.text();
    let errorBody: { error?: string } | null = null;
    if (rawBody) {
      try {
        errorBody = JSON.parse(rawBody) as { error?: string };
      } catch {
        errorBody = null;
      }
    }

    const vercelError = response.headers.get('x-vercel-error');
    const responseText = rawBody.trim();
    const fallbackMessage = `LLM request failed (${response.status}${vercelError ? `: ${vercelError}` : ''}).`;
    const message =
      errorBody?.error ??
      (responseText && !responseText.startsWith('<!doctype html') ? responseText : fallbackMessage);

    llmDebug('config: error body', {
      status: response.status,
      vercelError,
      message,
      rawBody: responseText,
    });
    throw new Error(message);
  }

  const data = (await response.json()) as ApiConfig;
  llmDebug('config: output', data);
  return data;
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
        const generatedConfig = await requestPayloadFromServer({
          prompt,
          docsMarkdown,
          runtime,
          signal: controller.signal,
        });

        if (requestId !== activeRequestIdRef.current) return false;

        runtime.stop();
        const appliedConfig = runtime.setConfig(generatedConfig);
        const pretty = JSON.stringify(appliedConfig, null, 2);
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
