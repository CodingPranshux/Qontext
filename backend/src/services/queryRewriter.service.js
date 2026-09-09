import { config } from '../config/index.js';
import { fetchWithRetry } from '../utils/fetchWithRetry.js';

const REWRITE_SYSTEM_PROMPT = `Given a conversation history and a follow-up question, rewrite the follow-up into a standalone question that contains everything needed to understand it without the history — resolve pronouns and implicit references (e.g. "what about X" -> "What is X's <the actual thing being asked about>?").

Rules:
- If the follow-up is already standalone, return it unchanged.
- Never answer the question — only rewrite it.
- Respond with ONLY the rewritten question. No quotes, no explanation, no preamble.`;

function buildRewritePrompt(history, query) {
  const transcript = history.map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`).join('\n');
  return `Conversation so far:\n${transcript}\n\nFollow-up question: ${query}\n\nStandalone question:`;
}

/**
 * Rewrites a context-dependent follow-up ("what about shipping?", "which of
 * those is longer?") into a standalone question, via one small non-streaming
 * LLM call — this is what lets retrieval work for a follow-up that shares no
 * keywords with the documents at all. Only worth calling when there's
 * conversation history; see generation.service.js's guard for that, plus its
 * fallback if this call fails.
 */
export async function rewriteQuery({ query, history }) {
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
      stream: false,
      temperature: 0,
      messages: [
        { role: 'system', content: REWRITE_SYSTEM_PROMPT },
        { role: 'user', content: buildRewritePrompt(history, query) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Query rewrite request failed (${response.status}): ${body}`);
    err.status = 502;
    err.upstreamStatus = response.status;
    throw err;
  }

  const data = await response.json();
  const rewritten = data.choices?.[0]?.message?.content?.trim();
  return rewritten || query;
}
