function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * Renders aggregate + per-question eval results as a Markdown report —
 * a pure formatting function so it's testable without running a real eval.
 */
export function formatReport({ retrieval, faithfulness, perQuestion, generatedAt = new Date() }) {
  const lines = [];

  lines.push('# RAG Eval Report');
  lines.push('');
  lines.push(`Generated: ${generatedAt.toISOString()}`);
  lines.push(`Questions evaluated: ${perQuestion.length}`);
  lines.push('');

  lines.push('## Aggregate scores');
  lines.push('');
  lines.push('| Metric | Score |');
  lines.push('|---|---|');
  lines.push(`| Retrieval precision | ${retrieval.precision.toFixed(3)} |`);
  lines.push(`| Retrieval recall | ${retrieval.recall.toFixed(3)} |`);
  lines.push(`| Retrieval F1 | ${retrieval.f1.toFixed(3)} |`);
  lines.push(`| Faithfulness rate | ${faithfulness.faithfulRate.toFixed(3)} (${faithfulness.faithfulCount}/${faithfulness.total}) |`);
  lines.push('');

  lines.push('## Per-question results');
  lines.push('');
  lines.push('| # | Question | Precision | Recall | Faithful | Notes |');
  lines.push('|---|---|---|---|---|---|');
  for (const q of perQuestion) {
    const notes = q.unsupportedClaims?.length ? escapeCell(q.unsupportedClaims.join('; ')) : '';
    lines.push(
      `| ${escapeCell(q.id)} | ${escapeCell(q.question)} | ${q.precision.toFixed(2)} | ${q.recall.toFixed(2)} | ${q.faithful ? '✅' : '❌'} | ${notes} |`
    );
  }
  lines.push('');

  return lines.join('\n');
}
