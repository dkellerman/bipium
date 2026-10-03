// Local development only: records what voice and rhythm analysis saw and decided, to
// `.voice-log/` via the dev server, so real attempts can be diagnosed afterwards.
export const DEV_LOG = import.meta.env.DEV && import.meta.env.MODE !== 'test';

export function devLog(type: string, data: Record<string, unknown>) {
  if (!DEV_LOG) return;
  void fetch('/api/dev-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ at: new Date().toISOString(), type, ...data }),
  }).catch(() => {});
}

/** Uploads raw mic audio in batches, so detectors can be replayed on real attempts. */
export class DevAudioRecorder {
  private readonly session = new Date().toISOString().replace(/[:.]/g, '-');
  private chunks: Int16Array[] = [];
  private samples = 0;
  constructor(private readonly batch: number) {
    if (DEV_LOG) devLog('audio', { session: this.session });
  }
  push(pcm: Int16Array) {
    if (!DEV_LOG) return;
    this.chunks.push(pcm.slice());
    this.samples += pcm.length;
    if (this.samples >= this.batch) this.flush();
  }
  flush() {
    if (!DEV_LOG || !this.samples) return;
    const all = new Int16Array(this.samples);
    let offset = 0;
    for (const chunk of this.chunks) {
      all.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];
    this.samples = 0;
    void fetch(`/api/dev-audio?session=${this.session}`, { method: 'POST', body: all.buffer }).catch(() => {});
  }
}
