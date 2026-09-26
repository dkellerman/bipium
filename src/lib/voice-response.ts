export async function readVoiceResponse(response: Response, onStatus: (message: string) => void) {
  if (!response.headers.get('Content-Type')?.includes('application/x-ndjson')) {
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Could not interpret that phrase.');
    return result;
  }
  const reader = response.body?.getReader();
  if (!reader) throw Error('The voice response was empty.');
  const decoder = new TextDecoder();
  let buffer = '';
  let result;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === 'status') onStatus(event.message);
    else if (event.type === 'error') throw Error(event.error);
    else if (event.type === 'result') result = event.result;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        consume(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
      if (done) break;
    }
    consume(buffer);
    if (!result) throw Error('The voice response was interrupted. Try again.');
    return result;
  } finally { reader.releaseLock(); }
}
