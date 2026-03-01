import { useEffect, useMemo, useState } from 'react';
import copyToClipboard from 'copy-to-clipboard';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { API_DEFAULT_CONFIG, API_DISCOVERY } from '@/api';
import type { ApiConfig, ValidationResult } from '@/types';
import { useApi } from '@/hooks/useApi';

const BASIC_SAMPLE: ApiConfig = {
  bpm: 100,
  beats: 4,
  subDivs: 1,
  playSubDivs: true,
  swing: 0,
  soundPack: 'drumkit',
  volume: 35,
};

const SWING_SAMPLE: ApiConfig = {
  bpm: 118,
  beats: 4,
  subDivs: 2,
  playSubDivs: true,
  swing: 28,
  soundPack: 'drumkit',
  volume: 38,
};

const METHOD_DOCS = [
  {
    method: 'window.bpm.schemas',
    summary: 'Live zod schema objects. Use for safeParse/introspection in JavaScript tooling.',
  },
  {
    method: 'window.bpm.schemaJson',
    summary: 'JSON Schema snapshots exported from the zod schemas.',
  },
  {
    method: 'window.bpm.getSchemaJson()',
    summary: 'Returns schemaJson as a fresh value for logs/tooling.',
  },
  {
    method: 'window.bpm.start(bpm?, beats?, subDivs?, swing?, soundPack?, volume?)',
    summary: 'Apply optional config parameters, validate, then start playback.',
  },
  { method: 'window.bpm.stop()', summary: 'Stop playback.' },
  { method: 'window.bpm.toggle()', summary: 'Toggle started/stopped; returns new started state.' },
  { method: 'window.bpm.isStarted()', summary: 'Return whether metronome is currently started.' },
  {
    method: 'window.bpm.setConfig(partial)',
    summary: 'Validate and apply a partial config object.',
  },
  { method: 'window.bpm.getConfig()', summary: 'Return active full config object.' },
  {
    method: 'window.bpm.validateConfig(input)',
    summary: 'Validate config-like input and return { ok, value|error }.',
  },
  {
    method: 'window.bpm.fromQuery(query?)',
    summary: 'Parse query string into a validated full config.',
  },
  {
    method: 'window.bpm.toQuery(config?)',
    summary: 'Build query string from config (or current config).',
  },
  {
    method: 'window.bpm.applyQuery(query?)',
    summary: 'Parse query string and apply resulting config.',
  },
  { method: 'window.bpm.tap()', summary: 'Trigger a user click sound immediately.' },
  {
    method: 'window.bpm.getSoundPacks()',
    summary: 'Return available sound pack keys.',
  },
] as const;

const URL_PARAM_DOCS = [
  { key: 'bpm', type: 'number', range: '20..320', required: 'no' },
  { key: 'beats', type: 'integer', range: '1..12', required: 'no' },
  { key: 'playSubDivs', type: 'boolean', range: 'true/false', required: 'no' },
  { key: 'subDivs', type: 'integer', range: '1..8', required: 'no' },
  { key: 'swing', type: 'number', range: '0..100', required: 'no' },
  { key: 'soundPack', type: 'string', range: 'defaults|drumkit', required: 'no' },
  { key: 'volume', type: 'number', range: '0..100', required: 'no' },
] as const;

type Status = {
  tone: 'idle' | 'ok' | 'error';
  text: string;
};

function stringifySample(config: ApiConfig) {
  return JSON.stringify(config, null, 2);
}

function readPayload(payload: string): unknown {
  return JSON.parse(payload);
}

function validationError(validated: ValidationResult) {
  return 'error' in validated ? validated.error : 'Invalid config.';
}

export default function ApiPage() {
  const [payload, setPayload] = useState(() => stringifySample(BASIC_SAMPLE));
  const [status, setStatus] = useState<Status>({
    tone: 'idle',
    text: 'Runtime is loading...',
  });
  const [liveStarted, setLiveStarted] = useState(false);
  const [liveConfig, setLiveConfig] = useState<ApiConfig>({ ...API_DEFAULT_CONFIG });

  const runtime = useApi(config => {
    setLiveConfig(config);
    setStatus(current => {
      if (current.tone === 'error') return current;
      return {
        tone: 'ok',
        text: `Config ${config.bpm} BPM, ${config.beats} beats, sub ${config.playSubDivs ? config.subDivs : 1}.`,
      };
    });
  });

  const preview = useMemo(() => {
    if (!runtime) {
      return {
        ok: false,
        query: '',
        error: 'Runtime not ready yet.',
      };
    }

    try {
      const parsed = readPayload(payload);
      const validated = runtime.validateConfig(parsed);
      if (!validated.ok) {
        return {
          ok: false,
          query: '',
          error: validationError(validated),
        };
      }

      return {
        ok: true,
        query: runtime.toQuery(validated.value),
        error: '',
      };
    } catch (error) {
      return {
        ok: false,
        query: '',
        error: error instanceof Error ? error.message : 'Invalid JSON.',
      };
    }
  }, [payload, runtime]);

  const schemaJson = useMemo(() => runtime?.getSchemaJson() ?? null, [runtime]);

  useEffect(() => {
    if (!runtime) return;
    setLiveStarted(runtime.isStarted());
    setStatus({
      tone: 'ok',
      text: 'Runtime ready. Edit JSON and use Start/Stop.',
    });
  }, [runtime]);

  function formatJson() {
    try {
      const parsed = readPayload(payload);
      setPayload(JSON.stringify(parsed, null, 2));
      setStatus({ tone: 'ok', text: 'JSON formatted.' });
    } catch (error) {
      setStatus({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not format JSON.',
      });
    }
  }

  function validateJson() {
    if (!runtime) {
      setStatus({ tone: 'error', text: 'Runtime not ready yet.' });
      return;
    }

    try {
      const parsed = readPayload(payload);
      const validated = runtime.validateConfig(parsed);
      if (!validated.ok) {
        setStatus({ tone: 'error', text: validationError(validated) });
        return;
      }
      setStatus({ tone: 'ok', text: 'Config is valid.' });
    } catch (error) {
      setStatus({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Invalid JSON payload.',
      });
    }
  }

  function runLive() {
    if (!runtime) {
      setStatus({ tone: 'error', text: 'Runtime not ready yet.' });
      return;
    }

    try {
      const parsed = readPayload(payload);
      const validated = runtime.validateConfig(parsed);
      if (!validated.ok) {
        setStatus({ tone: 'error', text: validationError(validated) });
        return;
      }

      const config = runtime.setConfig(validated.value);
      runtime.start();
      setLiveStarted(runtime.isStarted());
      setStatus({
        tone: 'ok',
        text: `Started ${config.bpm} BPM, ${config.beats} beats, sub ${config.playSubDivs ? config.subDivs : 1}.`,
      });
    } catch (error) {
      setStatus({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not start runtime.',
      });
    }
  }

  function toggleStartStopLive() {
    if (!runtime) {
      setStatus({ tone: 'error', text: 'Runtime not ready yet.' });
      return;
    }

    if (runtime.isStarted()) {
      runtime.stop();
      setLiveStarted(false);
      setStatus({ tone: 'ok', text: 'Playback stopped.' });
      return;
    }

    try {
      const parsed = readPayload(payload);
      const validated = runtime.validateConfig(parsed);
      if (!validated.ok) {
        setStatus({ tone: 'error', text: validationError(validated) });
        return;
      }
      runtime.setConfig(validated.value);
      runtime.start();
      setLiveStarted(true);
      setStatus({ tone: 'ok', text: 'Playback started.' });
    } catch (error) {
      setStatus({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not start runtime.',
      });
    }
  }

  function copyConfigUrl() {
    if (!runtime) {
      setStatus({ tone: 'error', text: 'Runtime not ready yet.' });
      return;
    }

    try {
      const parsed = readPayload(payload);
      const validated = runtime.validateConfig(parsed);
      if (!validated.ok) {
        setStatus({ tone: 'error', text: validationError(validated) });
        return;
      }

      const query = runtime.toQuery(validated.value);
      const url = `${window.location.origin}/${query}`;
      copyToClipboard(url, { format: 'text/plain' });
      setStatus({ tone: 'ok', text: `Copied ${url}` });
    } catch (error) {
      setStatus({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not copy URL.',
      });
    }
  }

  const statusClass =
    status.tone === 'error'
      ? 'text-rose-700'
      : status.tone === 'ok'
        ? 'text-emerald-700'
        : 'text-slate-600';

  return (
    <main
      className={cn(
        'mx-auto flex min-h-dvh w-full max-w-[860px] flex-col gap-3 bg-white px-3 py-4 text-slate-900',
        'shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
      )}
    >
      <div className="flex items-center gap-2">
        <Link className={buttonVariants({ variant: 'outline' })} to="/">
          Back to app
        </Link>
        <a className={buttonVariants({ variant: 'outline' })} href="/api.md">
          API markdown
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bipium Browser API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>
            Canonical runtime entrypoint: <code>window.bpm</code>
          </p>
          <p>
            Discovery docs: <code>{API_DISCOVERY.ui}</code>, <code>{API_DISCOVERY.markdown}</code>,{' '}
            <code>{API_DISCOVERY.llms}</code>, <code>{API_DISCOVERY.agents}</code>
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Build config in JSON.</li>
            <li>
              Validate with <code>window.bpm.validateConfig(...)</code>.
            </li>
            <li>
              Run with <code>window.bpm.start(...)</code> or set + start.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Core Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="py-2 pr-3 font-medium">Method</th>
                  <th className="py-2 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {METHOD_DOCS.map(entry => (
                  <tr key={entry.method} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-mono text-[12px]">{entry.method}</td>
                    <td className="py-2 text-slate-700">{entry.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>URL Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="py-2 pr-3 font-medium">Key</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Range</th>
                  <th className="py-2 font-medium">Required</th>
                </tr>
              </thead>
              <tbody>
                {URL_PARAM_DOCS.map(entry => (
                  <tr key={entry.key} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-mono">{entry.key}</td>
                    <td className="py-2 pr-3">{entry.type}</td>
                    <td className="py-2 pr-3">{entry.range}</td>
                    <td className="py-2">{entry.required}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instructions for AI</CardTitle>
        </CardHeader>
        <CardContent>
          <details className="rounded border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-900">
              Configuration Process (with gotchas)
            </summary>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              <li>Create one canonical config object first.</li>
              <li>
                Validate first: call <code>window.bpm.validateConfig(input)</code>.
              </li>
              <li>If invalid, stop and fix payload before playback.</li>
              <li>
                Prefer <code>window.bpm.start(...)</code> for one-shot apply+start.
              </li>
              <li>
                For link workflows, use <code>window.bpm.toQuery(config)</code> and{' '}
                <code>window.bpm.applyQuery(query)</code>.
              </li>
              <li>
                Swing is meaningful only when sub-divisions are enabled and the sub-div count is
                even.
              </li>
            </ol>
            <p className="mt-3 text-sm text-slate-700">
              Gotcha: unknown keys are rejected by the strict schema, so payload objects must only
              include documented fields.
            </p>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zod Schemas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>
            Runtime exposes <code>window.bpm.schemas</code>, <code>window.bpm.schemaJson</code>, and{' '}
            <code>window.bpm.getSchemaJson()</code>.
          </p>
          <details className="rounded border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer font-medium text-slate-900">
              JSON Schema Snapshot
            </summary>
            <p className="mt-2 text-xs text-slate-600">
              Mirrors <code>window.bpm.schemaJson</code>.
            </p>
            <p className="mt-2 font-mono text-xs text-slate-900">config</p>
            <pre className="mt-1 max-h-44 overflow-auto rounded border border-slate-200 bg-white p-2 text-[11px] text-slate-700">
              {schemaJson ? JSON.stringify(schemaJson.config, null, 2) : 'Runtime not ready yet.'}
            </pre>
            <p className="mt-2 font-mono text-xs text-slate-900">configPatch</p>
            <pre className="mt-1 max-h-44 overflow-auto rounded border border-slate-200 bg-white p-2 text-[11px] text-slate-700">
              {schemaJson
                ? JSON.stringify(schemaJson.configPatch, null, 2)
                : 'Runtime not ready yet.'}
            </pre>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live JSON Viewer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-700">
            Edit JSON, validate, generate URL params, and run live. No LLM prompt box is included.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPayload(stringifySample(BASIC_SAMPLE))}
            >
              Load Basic
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPayload(stringifySample(SWING_SAMPLE))}
            >
              Load Swing
            </Button>
            <Button type="button" variant="outline" onClick={formatJson}>
              Format
            </Button>
            <Button type="button" variant="outline" onClick={validateJson}>
              Validate
            </Button>
            <Button type="button" onClick={toggleStartStopLive}>
              {liveStarted ? 'Stop' : 'Start'}
            </Button>
            <Button type="button" variant="outline" onClick={copyConfigUrl}>
              Copy URL
            </Button>
          </div>

          <textarea
            className="h-[320px] w-full rounded-md border border-slate-300 p-3 font-mono text-xs outline-none"
            value={payload}
            onChange={event => setPayload(event.target.value)}
            spellCheck={false}
          />

          <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
            <p className="font-medium text-slate-700">Query preview</p>
            <p className="mt-1 font-mono text-slate-700">
              {preview.ok ? preview.query || '(empty query)' : `invalid: ${preview.error}`}
            </p>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
            <p className="font-medium text-slate-700">Live config</p>
            <pre className="mt-1 overflow-x-auto text-slate-700">
              {JSON.stringify(liveConfig, null, 2)}
            </pre>
          </div>

          <p className="text-xs text-slate-600">
            Playback state: <strong>{liveStarted ? 'started' : 'stopped'}</strong>
          </p>

          <p className={cn('text-sm', statusClass)}>{status.text}</p>
        </CardContent>
      </Card>
    </main>
  );
}
