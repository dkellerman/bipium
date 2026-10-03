// Runs rhythm analysis off the main thread so the visualizer never stutters.
import { diagnoseOnsets } from './rhythm-tracker';

self.onmessage = ({ data }) => {
  const diagnosis = diagnoseOnsets(data.onsets, data.now, data.speech);
  self.postMessage({ input: data, result: diagnosis.result, diagnosis });
};
