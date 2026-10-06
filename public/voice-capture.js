// The context runs at the hardware's rate: forcing one makes the browser resample the
// whole audio path, heard as crackling. The transcriber and detectors get 48 kHz, made
// here by linear interpolation (exact passthrough when the hardware is already 48 kHz).
const OUTPUT_RATE = 48000;

class VoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(4800);
    this.offset = 0;
    this.step = sampleRate / OUTPUT_RATE; // input samples per output sample
    this.position = 0; // next output's position after `previous`, in input samples
    this.previous = 0;
  }
  emit(sample) {
    const value = Math.max(-1, Math.min(1, sample));
    this.buffer[this.offset++] = value < 0 ? value * 32768 : value * 32767;
    if (this.offset === this.buffer.length) {
      this.port.postMessage(this.buffer.buffer, [this.buffer.buffer]);
      this.buffer = new Int16Array(4800);
      this.offset = 0;
    }
  }
  process(inputs) {
    const samples = inputs[0]?.[0];
    if (samples)
      for (const sample of samples) {
        while (this.position < 1) {
          this.emit(this.previous + (sample - this.previous) * this.position);
          this.position += this.step;
        }
        this.position -= 1;
        this.previous = sample;
      }
    return true;
  }
}
registerProcessor('voice-capture', VoiceCapture);
