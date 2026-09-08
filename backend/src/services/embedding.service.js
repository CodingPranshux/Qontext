import { config } from '../config/index.js';

/**
 * Embeds one text via Google's Gemini embedding API (gemini-embedding-001
 * by default). Uses the single-item embedContent endpoint rather than
 * batchEmbedContents — its per-item request shape is the one Google's docs
 * confirm unambiguously ({ content: { parts: [{ text }] } } in, { embedding:
 * { values: [...] } } out), whereas the batch endpoint's exact per-item
 * shape is less clearly documented. embedTexts() below calls this once per
 * text in parallel instead.
 */
async function embedOne(text) {
  const url = `${config.embedding.apiUrl}/${config.embedding.model}:embedContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.embedding.apiKey,
    },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      // Match the vector store's column width (see config.vectorStore.dimensions)
      // rather than Gemini's full 3072-dim default.
      output_dimensionality: config.vectorStore.dimensions,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Embedding request failed (${response.status}): ${body}`);
    err.status = 502; // this server's own response code — we failed to reach a dependency
    err.upstreamStatus = response.status; // the dependency's actual code (e.g. 429), for callers that need to distinguish retryable failures
    throw err;
  }

  const data = await response.json();
  return data.embedding.values;
}

/**
 * Embeds a batch of texts, in the same order as the input. This project's
 * chunk-per-document counts are small enough that N parallel single-item
 * calls are well within Gemini's free-tier rate limits.
 */
export async function embedTexts(texts) {
  if (!config.embedding.apiKey) {
    const err = new Error('EMBEDDING_API_KEY is not configured');
    err.status = 500;
    throw err;
  }

  return Promise.all(texts.map((text) => embedOne(text)));
}
