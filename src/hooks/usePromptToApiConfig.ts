import { useCallback, useRef, useState } from 'react';
import type { RuntimeApi } from '@/types';

type ResponsesApiOutput = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

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

const CONFIG_SYSTEM_PROMPT = `
  You generate valid Bipium runtime config JSON only.
  Return exactly one JSON object and no markdown.
  Match the requested groove, timing, looping, sound choice, and any explicit sound URLs.
  Use soundUrls for individual audio-file overrides.
  Keep loopMode false unless the user explicitly requests a drum loop.
  Use swing sparingly. Default to swing=0 unless the user explicitly asks for swing/shuffle or the requested groove strongly implies it.
  Treat swing around 33 as basic swing, around 50 as a very heavy shuffle, and almost never go above 50.
  If the user wants only a little swing, that usually means noticeably less than 33.
`.trim();

function extractOutputText(data: ResponsesApiOutput) {
  for (const outputItem of data.output ?? []) {
    if (outputItem.type !== 'message') continue;
    for (const contentItem of outputItem.content ?? []) {
      if (contentItem.type === 'output_text' && contentItem.text) {
        return contentItem.text;
      }
    }
  }
  return null;
}

async function requestPayloadFromModel(params: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  schemaName: string;
  schema: object;
  signal?: AbortSignal;
}) {
  const payload = {
    model: params.model,
    temperature: 0,
    text: {
      format: {
        type: 'json_schema',
        name: params.schemaName,
        schema: params.schema,
        strict: false,
      },
    },
    input: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
  };

  llmDebug('config: request', {
    model: params.model,
    schemaName: params.schemaName,
    systemChars: params.system.length,
    userChars: params.user.length,
  });

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: params.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    llmDebug('config: error body', { preview: text.slice(0, 600) });
    throw new Error(`LLM request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as ResponsesApiOutput;
  const content = extractOutputText(data);
  if (!content) {
    llmDebug('config: empty output', data);
    throw new Error('Model returned empty content.');
  }

  llmDebug('config: output', { outputChars: content.length });
  return JSON.parse(content) as unknown;
}

function buildUserPrompt(prompt: string, docsMarkdown: string, runtime: RuntimeApi) {
  return `
    Request: ${prompt}

    Bipium API docs:
    ${docsMarkdown}

    Current config:
    ${JSON.stringify(runtime.getConfig(), null, 2)}

    Available sound packs:
    ${runtime.getSoundPacks().join(', ')}

    Requirements:
    - Return a full Bipium config JSON object matching the schema.
    - Prefer soundPack when built-in sounds are enough.
    - Use soundUrls only for explicit per-sound file overrides.
    - Use loopMode=true only for drum loop playback.
    - loopRepeats=0 means forever.
    - loopPattern arrays must match the current step count implied by beats/subDivs/playSubDivs.
    - Use swing conservatively: 0 by default, around 33 for basic swing, around 50 for a full shuffle feel, and almost never above 50.
    - If the request only suggests a little swing, pick a value well below 33.
    - Do not include markdown or explanation.
  `.trim();
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

      const apiKey = (import.meta.env.VITE_OPENAI_KEY as string | undefined)?.trim() ?? '';
      if (!apiKey) {
        console.warn('AI prompt aborted: missing VITE_OPENAI_KEY.');
        onStatusChange('Missing VITE_OPENAI_KEY.');
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
        const model =
          (import.meta.env.VITE_OPENAI_MODEL as string | undefined)?.trim() || 'gpt-4.1';

        onStatusChange('Generating runtime config...');
        const parsedRaw = await requestPayloadFromModel({
          apiKey,
          model,
          system: CONFIG_SYSTEM_PROMPT,
          user: buildUserPrompt(prompt, docsMarkdown, runtime),
          schemaName: 'bipium_runtime_config',
          schema: runtime.getSchemaJson().config as object,
          signal: controller.signal,
        });

        if (requestId !== activeRequestIdRef.current) return false;

        const validation = runtime.validateConfig(parsedRaw);
        if (!validation.ok) {
          throw new Error(
            `Validation failed: ${'error' in validation ? validation.error : 'Invalid config.'}`,
          );
        }

        const pretty = JSON.stringify(validation.value, null, 2);
        runtime.setConfig(validation.value);
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
