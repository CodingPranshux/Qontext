import { config } from '../config/index.js';
import { fetchWithRetry } from '../utils/fetchWithRetry.js';

/**
 * Streams one chat completion via Groq's OpenAI-compatible chat completions
 * API, invoking onToken(deltaText) as content arrives, and resolving with
 * the full accumulated text once the stream ends. Groq mirrors OpenAI's
 * request/response/SSE shape exactly, so this is unchanged from calling
 * OpenAI directly other than the base URL and model name.
 *
 * This is the only network-calling piece of Phase 4's generation step —
 * everything else (prompt building, citation validation, orchestration)
 * lives in generation.service.js and is unit-testable without it.
 */
export async function streamChatCompletion({ systemPrompt, history = [], userPrompt, onToken }) {
  if (!config.llm.apiKey) {
    const err = new Error('LLM_API_KEY is not configured');
    err.status = 500;
    throw err;
  }

  const response = await fetchWithRetry(config.llm.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.llm.apiKey}`,
    },
    body: JSON.stringify({
      model: config.llm.model,
      stream: true,
      // Prior conversation turns go between the system prompt and the
      // current question, as real chat messages rather than text stuffed
      // into one string — this is what lets the model naturally resolve
      // follow-ups ("what about X?") using earlier turns.
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => '');
    const err = new Error(`LLM request failed (${response.status}): ${body}`);
    err.status = 502; // this server's own response code — we failed to reach a dependency
    err.upstreamStatus = response.status; // the dependency's actual code (e.g. 429), for callers that need to distinguish retryable failures
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // last line may be incomplete — keep it for the next chunk

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;

      const payload = trimmed.slice('data:'.length).trim();
      if (payload === '[DONE]') continue;

      const parsed = JSON.parse(payload);
      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        onToken?.(delta);
      }
    }
  }

  return fullText;
}
