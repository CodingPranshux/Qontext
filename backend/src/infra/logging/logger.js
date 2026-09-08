import { appendFileSync } from 'node:fs';
import { config } from '../../config/index.js';
import { getContext } from './requestContext.js';

/**
 * Logs one structured JSON line per pipeline stage, automatically tagged
 * with the current request's requestId/tenantId (from AsyncLocalStorage —
 * see requestContext.js) so every log line is traceable to the request and
 * tenant that produced it, with no changes needed in the stage's own code.
 */
export function logStage(stage, fields = {}) {
  const ctx = getContext() || {};
  const entry = {
    ts: new Date().toISOString(),
    requestId: ctx.requestId ?? null,
    tenantId: ctx.tenantId ?? null,
    stage,
    ...fields,
  };

  const line = JSON.stringify(entry);
  // eslint-disable-next-line no-console
  console.log(line);

  if (config.logFile) {
    appendFileSync(config.logFile, line + '\n');
  }
}
