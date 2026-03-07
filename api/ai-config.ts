import {
  createSchemas,
  mergeConfig,
  normalizeLoopModeConfig,
  type ApiConfig,
} from '../src/core/api';

type ResponsesApiOutput = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

type AiConfigRequestBody = {
  prompt: string;
  docsMarkdown: string;
  currentConfig: unknown;
  soundPacks: string[];
};

class RequestValidationError extends Error {}

const CONFIG_SYSTEM_PROMPT = `
  You generate valid Bipium runtime config JSON only.
  Return exactly one JSON object and no markdown.
  Match the requested groove, timing, looping, sound choice, and any explicit sound URLs.
  Prefer the drumkit sound pack for musical grooves and drum loops.
  Do not choose beepy/default metronome sounds unless the user explicitly asks for beeps, clicks, or a plain practice metronome sound.
  Use soundUrls for individual audio-file overrides.
  Keep loopMode false unless the user explicitly requests a drum loop.
  If the user does not explicitly want drum-loop playback, return the default seeded loopPattern for the requested timing instead of preserving or inventing a custom pattern.
  Only return a custom loopPattern when the user clearly wants drum-loop playback.
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

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validatePrompt(value: unknown) {
  if (typeof value !== 'string') {
    throw new RequestValidationError('prompt must be a string.');
  }

  const prompt = value.trim();
  if (!prompt) {
    throw new RequestValidationError('prompt must not be empty.');
  }
  if (prompt.length > 4000) {
    throw new RequestValidationError('prompt must be at most 4000 characters.');
  }

  return prompt;
}

function validateDocsMarkdown(value: unknown) {
  if (value === undefined) return '';
  if (typeof value !== 'string') {
    throw new RequestValidationError('docsMarkdown must be a string.');
  }
  if (value.length > 100000) {
    throw new RequestValidationError('docsMarkdown must be at most 100000 characters.');
  }
  return value;
}

function validateSoundPacks(value: unknown) {
  if (!Array.isArray(value)) {
    throw new RequestValidationError('soundPacks must be an array.');
  }
  if (value.length > 32) {
    throw new RequestValidationError('soundPacks must contain at most 32 items.');
  }

  return value.map((soundPack, index) => {
    if (typeof soundPack !== 'string') {
      throw new RequestValidationError(`soundPacks[${index}] must be a string.`);
    }

    const trimmed = soundPack.trim();
    if (!trimmed) {
      throw new RequestValidationError(`soundPacks[${index}] must not be empty.`);
    }

    return trimmed;
  });
}

function parseRequestBody(payload: unknown): AiConfigRequestBody {
  if (!isPlainObject(payload)) {
    throw new RequestValidationError('Request body must be a JSON object.');
  }

  return {
    prompt: validatePrompt(payload.prompt),
    docsMarkdown: validateDocsMarkdown(payload.docsMarkdown),
    currentConfig: payload.currentConfig,
    soundPacks: validateSoundPacks(payload.soundPacks),
  };
}

function buildUserPrompt(params: {
  prompt: string;
  docsMarkdown: string;
  currentConfig: unknown;
  soundPacks: string[];
}) {
  return `
    Request: ${params.prompt}

    Bipium API docs:
    ${params.docsMarkdown}

    Current config:
    ${JSON.stringify(params.currentConfig, null, 2)}

    Available sound packs:
    ${params.soundPacks.join(', ')}

    Requirements:
    - Return a full Bipium config JSON object matching the schema.
    - Prefer soundPack when built-in sounds are enough.
    - Prefer soundPack="drumkit" for grooves and drum loops.
    - Avoid soundPack="defaults" unless the user asks for beeps, clicks, or a plain metronome/practice tone.
    - Use soundUrls only for explicit per-sound file overrides.
    - Use loopMode=true only for drum loop playback.
    - If this is not a drum-loop request, set loopMode=false and return the default seeded loopPattern for the requested beats/subDivs/playSubDivs/swing.
    - Do not keep or mutate a previous custom loopPattern unless the request is explicitly asking for drum-loop playback.
    - loopRepeats=0 means forever.
    - loopPattern arrays must match the current step count implied by beats/subDivs/playSubDivs.
    - Use swing conservatively: 0 by default, around 33 for basic swing, around 50 for a full shuffle feel, and almost never above 50.
    - If the request only suggests a little swing, pick a value well below 33.
    - Do not include markdown or explanation.
  `.trim();
}

async function requestPayloadFromModel(params: {
  apiKey: string;
  model: string;
  prompt: string;
  docsMarkdown: string;
  currentConfig: unknown;
  soundPacks: string[];
  signal?: AbortSignal;
}) {
  const schemas = createSchemas(new Set(params.soundPacks));
  const currentConfigResult = schemas.config.safeParse(params.currentConfig);
  if (!currentConfigResult.success) {
    throw new RequestValidationError('Invalid current config payload.');
  }

  const payload = {
    model: params.model,
    temperature: 0,
    text: {
      format: {
        type: 'json_schema',
        name: 'bipium_runtime_config',
        schema: schemas.schemaJson.config,
        strict: false,
      },
    },
    input: [
      { role: 'system', content: CONFIG_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildUserPrompt({
          prompt: params.prompt,
          docsMarkdown: params.docsMarkdown,
          currentConfig: params.currentConfig,
          soundPacks: params.soundPacks,
        }),
      },
    ],
  };

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
    throw new Error(`LLM request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as ResponsesApiOutput;
  const content = extractOutputText(data);
  if (!content) {
    throw new Error('Model returned empty content.');
  }

  const mergedConfig = mergeConfig(
    currentConfigResult.data as ApiConfig,
    JSON.parse(content) as unknown,
    schemas,
  );

  return normalizeLoopModeConfig(mergedConfig);
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
    if (!apiKey) {
      return createJsonResponse({ error: 'Missing OPENAI_API_KEY on the server.' }, 500);
    }

    let requestJson: unknown;
    try {
      requestJson = await request.json();
    } catch {
      return createJsonResponse({ error: 'Request body must be valid JSON.' }, 400);
    }

    const body = parseRequestBody(requestJson);
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4.1';
    const parsed = await requestPayloadFromModel({
      apiKey,
      model,
      prompt: body.prompt,
      docsMarkdown: body.docsMarkdown,
      currentConfig: body.currentConfig,
      soundPacks: body.soundPacks,
      signal: request.signal,
    });

    return createJsonResponse(parsed);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return createJsonResponse({ error: error.message }, 400);
    }

    const message = error instanceof Error ? error.message : 'Unknown server error.';
    console.error('ai-config POST failed', error);
    return createJsonResponse({ error: message }, 500);
  }
}
