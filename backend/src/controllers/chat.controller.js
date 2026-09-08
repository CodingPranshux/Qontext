import { generateAnswer } from '../services/generation.service.js';
import { runRetrieval } from '../infra/cache/cachedRetrieval.js';
import { instrumentedStreamChatCompletion, instrumentedRewriteQuery } from '../infra/logging/instrumentedGeneration.js';

const MAX_HISTORY_TURNS = 10;

function writeSseEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Trusts only { role: 'user' | 'assistant', content: string } from the
 * client's conversation history, and caps how much of it we'll ever send to
 * the LLM — regardless of what the client sends, to bound prompt size/cost.
 */
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (turn) =>
        turn && (turn.role === 'user' || turn.role === 'assistant') && typeof turn.content === 'string'
    )
    .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 4000) }))
    .slice(-MAX_HISTORY_TURNS);
}

export async function postAsk(req, res) {
  const { query, history } = req.body;
  if (!query) {
    return res.status(400).json({ error: { message: 'query is required' } });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();

  // Once headers are sent, errors must be reported as an SSE event and the
  // stream closed — Express's normal error-handling middleware assumes it
  // can still set a status code, which it can't here.
  try {
    const { citedChunkIds } = await generateAnswer({
      tenantId: req.tenantId,
      query,
      history: sanitizeHistory(history),
      search: runRetrieval, // Phase 5: cached + logged retrieval instead of Phase 3's raw search
      streamChatCompletion: instrumentedStreamChatCompletion, // Phase 5: logged generate stage
      rewriteQuery: instrumentedRewriteQuery, // Phase 5: logged rewrite stage
      onRetrievalQuery: ({ query: retrievalQuery, rewritten }) =>
        writeSseEvent(res, 'retrieval', { query: retrievalQuery, rewritten }),
      onSources: (sources) => writeSseEvent(res, 'sources', { sources }),
      onToken: (token) => writeSseEvent(res, 'token', { content: token }),
    });

    writeSseEvent(res, 'done', { citedChunkIds });
  } catch (err) {
    writeSseEvent(res, 'error', { message: err.message });
  } finally {
    res.end();
  }
}
