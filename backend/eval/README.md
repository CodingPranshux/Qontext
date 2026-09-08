# Eval harness

Scores retrieval quality and answer faithfulness against a golden set of
question/expected-chunk pairs. See the main project README/ARCHITECTURE.md
for how this fits into the overall build.

## Files

- `goldenSet.json` — ~25 sample questions with the chunk(s) that should be
  retrieved for each, identified by `{ sourceFilename, chunkIndex }` (stable
  across re-ingestion) rather than a raw MongoDB `_id` (which changes every
  time you re-ingest). Extend this file with your own questions as you add
  real documents — just add matching entries to `expectedChunks`.
- `fixtures/*.txt` — the small corpus the golden set's questions are about.
  `runEval.js` ingests these automatically into a dedicated eval tenant.
- `scoring.js` — pure retrieval precision/recall/F1 functions (unit tested
  in `../tests/eval-scoring.test.js`).
- `faithfulness.js` — LLM-as-judge faithfulness scoring, with the judge
  itself injectable (unit tested with a fake judge in
  `../tests/eval-faithfulness.test.js`).
- `report.js` — pure Markdown report formatter (unit tested in
  `../tests/eval-report.test.js`).
- `runEval.js` — the CLI that wires the above together against the REAL
  pipeline (real MongoDB, real vector store, real OpenAI/Cohere calls).

## Running it

Requires a working `backend/.env` — real `MONGODB_URI`, `POSTGRES_URL`
(with the `vector` extension installed), `EMBEDDING_API_KEY`,
`RERANKER_API_KEY`, and `LLM_API_KEY`. This script is intentionally **not**
part of `npm run test` — the vitest suite checks the pipeline's plumbing
with mocked network calls; this script checks the pipeline's actual quality,
which requires the real APIs.

```bash
npm run eval
```

Output: a per-question console line as it runs, then a Markdown report
written to `eval/report.md` (and printed to the console).
