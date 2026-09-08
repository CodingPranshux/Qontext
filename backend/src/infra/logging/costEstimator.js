import { countTokens } from 'gpt-tokenizer';

/**
 * Illustrative USD pricing. These make per-stage cost *visible* in logs so
 * spend-per-request/tenant is legible — they are not billing-grade
 * accounting and will drift from real provider pricing over time; treat
 * them as a knob to update, not a source of truth for an invoice.
 *
 * Embedding (Gemini) and LLM (Groq) are both on free tiers with no card on
 * file — real spend is $0 while under those tiers' rate limits, hence 0
 * below. If you outgrow the free tier or swap to a paid provider, replace
 * these with that provider's then-current per-token pricing. Rerank (Cohere)
 * is left at its standard paid rate for cost-awareness even though the
 * project currently runs on Cohere's free trial tier.
 */
const PRICING = {
  embeddingPerMillionTokens: 0, // Gemini embedding API, free tier
  llmInputPerMillionTokens: 0, // Groq (Llama), free tier
  llmOutputPerMillionTokens: 0, // Groq (Llama), free tier
  rerankPerThousandSearches: 2.0, // Cohere Rerank — billed per "search" (query + up to 100 docs)
};

function round(usd) {
  return Math.round(usd * 1e6) / 1e6;
}

export function estimateEmbeddingCost(texts) {
  const tokenCount = texts.reduce((sum, text) => sum + countTokens(text), 0);
  return round((tokenCount / 1_000_000) * PRICING.embeddingPerMillionTokens);
}

export function estimateRerankCost(documentCount) {
  const searches = Math.max(1, Math.ceil(documentCount / 100));
  return round((searches / 1000) * PRICING.rerankPerThousandSearches);
}

export function estimateLLMCost({ promptText, completionText }) {
  const promptTokens = countTokens(promptText || '');
  const completionTokens = countTokens(completionText || '');
  const cost =
    (promptTokens / 1_000_000) * PRICING.llmInputPerMillionTokens +
    (completionTokens / 1_000_000) * PRICING.llmOutputPerMillionTokens;
  return round(cost);
}
