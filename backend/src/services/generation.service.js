import { search as defaultSearch } from './retrieval.service.js';
import { streamChatCompletion as defaultStreamChatCompletion } from './llmClient.service.js';
import { rewriteQuery as defaultRewriteQuery } from './queryRewriter.service.js';
import { extractCitedChunkIds } from './citation.service.js';

export const SYSTEM_PROMPT = `You are a helpful AI assistant embedded in a document Q&A product. You can both hold a normal conversation and answer questions using the user's uploaded documents.

You will be given "Context": chunks from the user's own documents that may or may not be relevant to their question, each labeled with a chunk_id.

Rules:
- If the Context contains information that answers the question, base your answer on it and immediately cite the supporting chunk_id(s) in the exact format [chunk_id: <id>] after each claim drawn from it.
- If the Context is empty, irrelevant, or only partially relevant, answer the parts it doesn't cover using your own general knowledge — this includes small talk, math, and general-knowledge questions. Never attach a [chunk_id: ...] citation to a claim that didn't actually come from the Context.
- Never invent a chunk_id that wasn't given to you below.
- Use the conversation history to understand follow-up questions (e.g. "what about X" referring to something asked earlier).`;

/**
 * Formats the reranked chunks as labeled context for the LLM. Kept as a
 * standalone, testable function — it's the one place that decides exactly
 * how a chunk_id is exposed to the model. Handles an empty result set (no
 * relevant documents) explicitly rather than emitting an empty context
 * block, since that's now a normal, expected case (general questions).
 */
export function buildUserPrompt({ query, chunks }) {
  const context =
    chunks.length > 0
      ? chunks.map((chunk) => `[chunk_id: ${chunk.chunkId}]\n${chunk.text}`).join('\n\n')
      : '(No relevant documents were found for this question.)';

  return `Context:\n${context}\n\nQuestion: ${query}`;
}

/**
 * Converts client-supplied conversation turns into chat messages, trusting
 * only role and content — anything else on a turn (there shouldn't be
 * anything else) is dropped.
 */
function toChatMessages(history) {
  return history.map((turn) => ({ role: turn.role, content: turn.content }));
}

/**
 * Cheap fallback contextualization: prepend the previous user turn so a
 * vague follow-up ("what about shipping?") at least embeds closer to the
 * right chunks. Only used if the real query rewrite (below) fails — a
 * rewrite failure should degrade retrieval quality, not break the request.
 */
function buildFallbackRetrievalQuery(query, history) {
  const lastUserTurn = [...history].reverse().find((turn) => turn.role === 'user');
  return lastUserTurn ? `${lastUserTurn.content}\n${query}` : query;
}

/**
 * Resolves what to actually search for. Skips the rewrite call entirely for
 * a conversation's first message (nothing to resolve against), which also
 * saves an LLM call on the common case. For a follow-up, asks the LLM to
 * turn it into a standalone question — e.g. "which of those is longer?"
 * becomes "Which takes longer, the refund window or the shipping time?" —
 * so retrieval can work even when the follow-up shares no keywords at all
 * with the documents.
 */
async function resolveRetrievalQuery({ query, history, rewriteQuery }) {
  if (history.length === 0) return query;

  try {
    return await rewriteQuery({ query, history });
  } catch {
    return buildFallbackRetrievalQuery(query, history);
  }
}

/**
 * Full Phase 4 pipeline (now hybrid document-grounded + general-purpose):
 * run Phase 3 retrieval -> build a prompt that labels each chunk with its
 * chunk_id -> stream the LLM's answer, with prior conversation turns
 * included so follow-ups and small talk work like a normal chatbot -> verify
 * which of the retrieved chunk_ids the answer actually (and validly) cited.
 *
 * Retrieval always runs (even for "what is 2+2") — it's cheap (cached,
 * skips reranking when there are no candidates) and simpler than a separate
 * routing/classification step; the system prompt is what decides whether
 * the retrieved context is actually relevant enough to use and cite.
 *
 * tenantId must already be a trusted value derived from the JWT — it flows
 * straight into `search`, which is where every tenant filter actually lives.
 */
export async function generateAnswer({
  tenantId,
  query,
  history = [],
  search = defaultSearch,
  streamChatCompletion = defaultStreamChatCompletion,
  rewriteQuery = defaultRewriteQuery,
  onRetrievalQuery,
  onSources,
  onToken,
}) {
  if (!tenantId) {
    throw new Error('generateAnswer requires a tenantId derived from the authenticated request');
  }

  const retrievalQuery = await resolveRetrievalQuery({ query, history, rewriteQuery });
  // Surfaced to the client so the UI can show what was actually searched for
  // (e.g. a follow-up rewritten into a standalone question) — retrieval
  // transparency, not just the final answer.
  onRetrievalQuery?.({ query: retrievalQuery, rewritten: retrievalQuery !== query });

  const { results } = await search({ tenantId, query: retrievalQuery });

  onSources?.(results);

  const userPrompt = buildUserPrompt({ query, chunks: results });
  const answer = await streamChatCompletion({
    systemPrompt: SYSTEM_PROMPT,
    history: toChatMessages(history),
    userPrompt,
    onToken,
  });

  const validChunkIds = results.map((r) => r.chunkId);
  const citedChunkIds = extractCitedChunkIds(answer, validChunkIds);

  return { answer, citedChunkIds };
}
