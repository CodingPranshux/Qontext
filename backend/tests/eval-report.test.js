import { describe, it, expect } from 'vitest';
import { formatReport } from '../eval/report.js';

describe('formatReport', () => {
  it('renders aggregate scores and a per-question table', () => {
    const report = formatReport({
      retrieval: { precision: 0.8, recall: 0.75, f1: 0.774 },
      faithfulness: { faithfulCount: 2, total: 2, faithfulRate: 1 },
      perQuestion: [
        { id: 'q1', question: 'What is the refund policy?', precision: 1, recall: 1, faithful: true, unsupportedClaims: [] },
        { id: 'q2', question: 'How long is shipping?', precision: 0.6, recall: 0.5, faithful: true, unsupportedClaims: [] },
      ],
      generatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(report).toContain('# RAG Eval Report');
    expect(report).toContain('Questions evaluated: 2');
    expect(report).toContain('0.800');
    expect(report).toContain('0.750');
    expect(report).toContain('q1');
    expect(report).toContain('What is the refund policy?');
    expect(report).toContain('✅');
  });

  it('surfaces unsupported claims and a failing mark for unfaithful answers', () => {
    const report = formatReport({
      retrieval: { precision: 0.5, recall: 0.5, f1: 0.5 },
      faithfulness: { faithfulCount: 0, total: 1, faithfulRate: 0 },
      perQuestion: [
        {
          id: 'q1',
          question: 'q',
          precision: 0.5,
          recall: 0.5,
          faithful: false,
          unsupportedClaims: ['made up a fact'],
        },
      ],
      generatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(report).toContain('❌');
    expect(report).toContain('made up a fact');
  });

  it('escapes pipe characters in question text so the Markdown table does not break', () => {
    const report = formatReport({
      retrieval: { precision: 1, recall: 1, f1: 1 },
      faithfulness: { faithfulCount: 1, total: 1, faithfulRate: 1 },
      perQuestion: [
        { id: 'q1', question: 'A | B?', precision: 1, recall: 1, faithful: true, unsupportedClaims: [] },
      ],
      generatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(report).toContain('A \\| B?');
  });
});
