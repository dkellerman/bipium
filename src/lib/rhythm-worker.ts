// Runs rhythm analysis off the main thread so the visualizer never stutters.
import { analyzeOnsets } from './rhythm-tracker';

self.onmessage = ({ data }) => {
  self.postMessage({ input: data, result: analyzeOnsets(data.onsets, data.now, data.speech) });
};
