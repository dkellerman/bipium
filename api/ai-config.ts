import { z } from 'zod';

type ResponsesApiOutput = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  docsMarkdown: z.string().max(100000).default(''),
  currentConfig: z.unknown(),
  soundPacks: z.array(z.string().min(1)).max(32),
  schema: z.unknown(),
});

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
  schema: object;
  signal?: AbortSignal;
}) {
  const payload = {
    model: params.model,
    temperature: 0,
    text: {
      format: {
        type: 'json_schema',
        name: 'bipium_runtime_config',
        schema: params.schema,
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

  return JSON.parse(content) as unknown;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
    if (!apiKey) {
      return Response.json({ error: 'Missing OPENAI_API_KEY on the server.' }, { status: 500 });
    }

    const body = requestSchema.parse(await request.json());
    if (!body.schema || typeof body.schema !== 'object' || Array.isArray(body.schema)) {
      return Response.json({ error: 'Invalid config schema payload.' }, { status: 400 });
    }

    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4.1';
    const parsed = await requestPayloadFromModel({
      apiKey,
      model,
      prompt: body.prompt,
      docsMarkdown: body.docsMarkdown,
      currentConfig: body.currentConfig,
      soundPacks: body.soundPacks,
      schema: body.schema as object,
      signal: request.signal,
    });

    return Response.json(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message ?? 'Invalid request body.' },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown server error.';
    return Response.json({ error: message }, { status: 500 });
  }
}
