class VoiceCapture extends AudioWorkletProcessor {
  constructor() { super(); this.buffer = new Int16Array(4800); this.offset = 0; }
  process(inputs) {
    const samples = inputs[0]?.[0];
    if (samples) for (const sample of samples) {
      const value = Math.max(-1, Math.min(1, sample));
      this.buffer[this.offset++] = value < 0 ? value * 32768 : value * 32767;
      if (this.offset === this.buffer.length) {
        this.port.postMessage(this.buffer.buffer, [this.buffer.buffer]);
        this.buffer = new Int16Array(4800); this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('voice-capture', VoiceCapture);
