import { config } from '../src/config/index.js';

const JUDGE_SYSTEM_PROMPT = `You are a strict fact-checking judge. You will be given a QUESTION, an ANSWER, and the CONTEXT chunks that were available to the assistant.

The assistant is a hybrid document Q&A + general-purpose chatbot: it answers document-grounded questions using ONLY the CONTEXT, but is allowed to answer general-knowledge, conversational, or off-document questions (small talk, math, etc.) using its own knowledge — those parts are not expected to appear in the CONTEXT and should NOT be marked unfaithful just because the CONTEXT doesn't cover them.

Decide whether the ANSWER is faithful: any claim that is presented as coming from the user's documents (attached to a [chunk_id: ...] citation, or phrased as a fact about "your account"/"the policy"/etc.) must actually be supported by the CONTEXT. Claims that are clearly general knowledge or conversational, not tied to the documents, are faithful regardless of the CONTEXT. It is also faithful if the assistant says it doesn't know rather than guessing about a document-specific question.

Respond with ONLY a JSON object, no other text, in this exact shape:
{"faithful": boolean, "unsupportedClaims": string[]}`;

function buildJudgePrompt({ question, answer, contextChunks }) {
  const context = contextChunks.map((chunk, i) => `[${i}] ${chunk}`).join('\n\n');
  return `QUESTION:\n${question}\n\nANSWER:\n${answer}\n\nCONTEXT:\n${context}`;
}

/** Default judge: the same LLM (Groq) used for generation, in JSON mode. Real network call — see faithfulness's tests for the injectable seam used to avoid it in the vitest suite. */
export async function defaultJudge({ question, answer, contextChunks }) {
  if (!config.llm.apiKey) {
    throw new Error('LLM_API_KEY is not configured — the faithfulness judge needs it');
  }

  const response = await fetch(config.llm.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.llm.apiKey}` },
    body: JSON.stringify({
      model: config.llm.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: JUDGE_SYSTEM_PROMPT },
        { role: 'user', content: buildJudgePrompt({ question, answer, contextChunks }) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Faithfulness judge request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
}

/**
 * Scores whether `answer` only asserts things present in `contextChunks`,
 * using an LLM as an automated judge. `judge` is injectable (tests supply a
 * fake) so this orchestration — and its defensive normalization of a
 * malformed judge response — is testable without a real API call.
 */
export async function scoreFaithfulness({ question, answer, contextChunks, judge = defaultJudge }) {
  const verdict = await judge({ question, answer, contextChunks });
  return {
    faithful: Boolean(verdict.faithful),
    unsupportedClaims: Array.isArray(verdict.unsupportedClaims) ? verdict.unsupportedClaims : [],
  };
}
