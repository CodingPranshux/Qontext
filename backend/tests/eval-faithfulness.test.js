import { describe, it, expect } from 'vitest';
import { scoreFaithfulness } from '../eval/faithfulness.js';

describe('scoreFaithfulness', () => {
  it('reports faithful=true with no unsupported claims when the judge says so', async () => {
    const judge = async () => ({ faithful: true, unsupportedClaims: [] });
    const result = await scoreFaithfulness({ question: 'q', answer: 'a', contextChunks: ['c'], judge });
    expect(result).toEqual({ faithful: true, unsupportedClaims: [] });
  });

  it('surfaces unsupported claims when the judge flags the answer as unfaithful', async () => {
    const judge = async () => ({ faithful: false, unsupportedClaims: ['claim not in context'] });
    const result = await scoreFaithfulness({ question: 'q', answer: 'a', contextChunks: ['c'], judge });
    expect(result.faithful).toBe(false);
    expect(result.unsupportedClaims).toEqual(['claim not in context']);
  });

  it('normalizes a malformed judge response defensively', async () => {
    const judge = async () => ({}); // missing both fields
    const result = await scoreFaithfulness({ question: 'q', answer: 'a', contextChunks: ['c'], judge });
    expect(result).toEqual({ faithful: false, unsupportedClaims: [] });
  });

  it('passes the question, answer, and context chunks through to the judge unchanged', async () => {
    let received;
    const judge = async (args) => {
      received = args;
      return { faithful: true, unsupportedClaims: [] };
    };

    await scoreFaithfulness({ question: 'What is X?', answer: 'X is Y.', contextChunks: ['X is Y per the docs.'], judge });

    expect(received).toEqual({
      question: 'What is X?',
      answer: 'X is Y.',
      contextChunks: ['X is Y per the docs.'],
    });
  });
});
