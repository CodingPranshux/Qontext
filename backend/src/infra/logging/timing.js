import { performance } from 'node:perf_hooks';

/**
 * Runs an async function and returns both its result and how long it took.
 * Used to time individual pipeline stages without threading timing code
 * through the stage's own implementation.
 */
export async function timeAsync(fn) {
  const start = performance.now();
  const result = await fn();
  return { result, durationMs: performance.now() - start };
}
