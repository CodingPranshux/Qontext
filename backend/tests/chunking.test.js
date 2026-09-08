import { describe, it, expect } from 'vitest';
import { encode } from 'gpt-tokenizer';
import { chunkText } from '../src/services/chunking.service.js';

const SENTENCE = 'The quick brown fox jumps over the lazy dog. ';

describe('chunkText', () => {
  it('returns no chunks for empty or whitespace-only text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n  ')).toEqual([]);
  });

  it('returns a single chunk when the text fits within chunkSize', () => {
    const text = SENTENCE.repeat(3);
    const chunks = chunkText(text, { chunkSize: 500, overlap: 50 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(text);
    expect(chunks[0].startOffset).toBe(0);
    expect(chunks[0].endOffset).toBe(text.length);
  });

  it('splits long text into multiple chunks capped at chunkSize tokens', () => {
    const text = SENTENCE.repeat(200); // well over 500 tokens
    const chunks = chunkText(text, { chunkSize: 100, overlap: 20 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(100);
    }
  });

  it('overlaps consecutive chunks by the configured token count', () => {
    const text = SENTENCE.repeat(200);
    const chunks = chunkText(text, { chunkSize: 100, overlap: 20 });

    for (let i = 1; i < chunks.length; i += 1) {
      const prevTail = encode(chunks[i - 1].text).slice(-20);
      const currHead = encode(chunks[i].text).slice(0, 20);
      expect(currHead).toEqual(prevTail);
    }
  });

  it('produces offsets that are exact positions into the original text', () => {
    const text = SENTENCE.repeat(200);
    const chunks = chunkText(text, { chunkSize: 100, overlap: 20 });

    for (const chunk of chunks) {
      expect(text.slice(chunk.startOffset, chunk.endOffset)).toBe(chunk.text);
    }
  });

  it('assigns increasing zero-based chunk indexes', () => {
    const text = SENTENCE.repeat(200);
    const chunks = chunkText(text, { chunkSize: 100, overlap: 20 });

    chunks.forEach((chunk, i) => expect(chunk.index).toBe(i));
  });

  it('defaults to ~500 token chunks with ~50 token overlap', () => {
    const text = SENTENCE.repeat(400);
    const chunks = chunkText(text);

    expect(chunks[0].tokenCount).toBeLessThanOrEqual(500);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('rejects invalid configuration', () => {
    expect(() => chunkText('hello', { chunkSize: 0 })).toThrow();
    expect(() => chunkText('hello', { chunkSize: 100, overlap: -1 })).toThrow();
    expect(() => chunkText('hello', { chunkSize: 100, overlap: 100 })).toThrow();
    expect(() => chunkText('hello', { chunkSize: 100, overlap: 150 })).toThrow();
  });
});
