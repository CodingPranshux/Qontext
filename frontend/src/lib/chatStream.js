import { API_BASE_URL } from './api.js';

/**
 * Posts a question to the SSE chat endpoint and dispatches each event as it
 * streams in. A plain fetch() + ReadableStream reader is used instead of the
 * browser's EventSource because EventSource only supports GET requests and
 * can't send an Authorization header — both of which we need here.
 */
export async function askQuestion({
  token,
  query,
  history = [],
  onRetrieval,
  onSources,
  onToken,
  onDone,
  onError,
  signal,
}) {
  const response = await fetch(`${API_BASE_URL}/chat/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, history }),
    signal,
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || `Request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop(); // last block may be incomplete — wait for more data

    for (const block of blocks) {
      const lines = block.split('\n');
      const eventLine = lines.find((l) => l.startsWith('event:'));
      const dataLine = lines.find((l) => l.startsWith('data:'));
      if (!eventLine || !dataLine) continue;

      const event = eventLine.slice('event:'.length).trim();
      const data = JSON.parse(dataLine.slice('data:'.length).trim());

      if (event === 'retrieval') onRetrieval?.(data);
      else if (event === 'sources') onSources?.(data.sources);
      else if (event === 'token') onToken?.(data.content);
      else if (event === 'done') onDone?.(data.citedChunkIds);
      else if (event === 'error') onError?.(data.message);
    }
  }
}
