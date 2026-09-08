import { streamChatCompletion as realStreamChatCompletion } from '../../services/llmClient.service.js';
import { rewriteQuery as realRewriteQuery } from '../../services/queryRewriter.service.js';
import { logStage } from './logger.js';
import { timeAsync } from './timing.js';
import { estimateLLMCost } from './costEstimator.js';

/**
 * Phase 5 wrapper around Phase 4's llmClient.service.js: logs the 'generate'
 * stage's latency and estimated cost, without modifying generation.service.js
 * or llmClient.service.js — plugged in via generateAnswer's existing
 * `streamChatCompletion` injection seam.
 */
export async function instrumentedStreamChatCompletion({ systemPrompt, history = [], userPrompt, onToken }) {
  const { result, durationMs } = await timeAsync(() =>
    realStreamChatCompletion({ systemPrompt, history, userPrompt, onToken })
  );

  const historyText = history.map((turn) => turn.content).join('\n');

  logStage('generate', {
    durationMs,
    costUsd: estimateLLMCost({ promptText: systemPrompt + historyText + userPrompt, completionText: result }),
  });

  return result;
}

/**
 * Phase 5 wrapper around queryRewriter.service.js: logs the 'rewrite' stage.
 * Errors are logged here (this is the observability layer) and then
 * re-thrown so generation.service.js's own try/catch still falls back to
 * its cheap heuristic — this wrapper doesn't change that behavior, only
 * makes it visible in the logs when it happens.
 */
export async function instrumentedRewriteQuery({ query, history }) {
  try {
    const { result, durationMs } = await timeAsync(() => realRewriteQuery({ query, history }));
    logStage('rewrite', {
      durationMs,
      costUsd: estimateLLMCost({
        promptText: history.map((turn) => turn.content).join('\n') + query,
        completionText: result,
      }),
    });
    return result;
  } catch (err) {
    logStage('rewrite', { status: 'error', error: err.message });
    throw err;
  }
}
