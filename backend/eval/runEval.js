/**
 * Eval harness CLI. Runs the golden set through the REAL pipeline — real
 * MongoDB, real vector store, real embedding/rerank/LLM API calls — so it
 * needs backend/.env populated with working credentials and a reachable
 * MongoDB + Postgres(pgvector). This is deliberately NOT part of the vitest
 * suite: the vitest suite (npm run test) checks the pipeline's *plumbing* is
 * correct with mocked network calls; this script checks the pipeline's
 * *quality* with the real thing, which can't be mocked without defeating
 * the point.
 *
 * Usage (from backend/):
 *   npm run eval
 */
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import vectorStore from '../src/models/vectorStore/index.js';
import { signup } from '../src/services/auth.service.js';
import { User } from '../src/models/User.js';
import { Document } from '../src/models/Document.js';
import { Chunk } from '../src/models/Chunk.js';
import { ingestDocument } from '../src/services/ingestion.service.js';
import { search } from '../src/services/retrieval.service.js';
import { generateAnswer } from '../src/services/generation.service.js';
import { scoreRetrieval, aggregateRetrievalScores } from './scoring.js';
import { scoreFaithfulness } from './faithfulness.js';
import { formatReport } from './report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The eval harness runs against multiple providers' free tiers, each with
 * its own requests-per-minute cap (e.g. Cohere's trial key: 10/min). Rather
 * than hardcode pacing for one specific provider's limit, this retries with
 * a fixed backoff on any 429 from any stage (embed/rerank/generate/judge) —
 * `upstreamStatus` is set by each network client specifically so callers
 * like this one can tell "rate limited, worth retrying" apart from "broken."
 */
async function withRetryOn429(fn, { attempts = 5, delayMs = 8000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (err.upstreamStatus !== 429 || attempt === attempts) throw err;
      console.log(`  (rate limited, waiting ${delayMs / 1000}s before retry ${attempt}/${attempts - 1})`);
      await sleep(delayMs);
    }
  }
  return undefined;
}

// A dedicated, stable tenant so re-running this script doesn't create a new
// tenant (and re-ingest fixtures) every time.
const EVAL_TENANT_NAME = 'Eval Fixture Tenant';
const EVAL_USER_EMAIL = 'eval-runner@example.com';
const EVAL_USER_PASSWORD = 'eval-runner-password-not-real';

async function ensureEvalUser() {
  const existing = await User.findOne({ email: EVAL_USER_EMAIL });
  if (existing) return existing;

  const { user } = await signup({
    email: EVAL_USER_EMAIL,
    password: EVAL_USER_PASSWORD,
    tenantName: EVAL_TENANT_NAME,
  });
  return user;
}

async function ensureFixturesIngested(tenantId, goldenSet) {
  const filenames = [...new Set(goldenSet.flatMap((q) => q.expectedChunks.map((c) => c.sourceFilename)))];

  for (const filename of filenames) {
    const alreadyIngested = await Document.findOne({ tenantId, filename });
    if (alreadyIngested) continue;

    const filePath = path.join(__dirname, 'fixtures', filename);
    const buffer = await readFile(filePath);
    console.log(`Ingesting fixture: ${filename}`);
    await ingestDocument({
      tenantId,
      file: { buffer, originalname: filename, mimetype: 'text/plain', size: buffer.length },
    });
  }
}

async function resolveExpectedChunkIds(tenantId, expectedChunks) {
  const ids = [];
  for (const { sourceFilename, chunkIndex = 0 } of expectedChunks) {
    const chunk = await Chunk.findOne({ tenantId, sourceFilename, chunkIndex });
    if (chunk) {
      ids.push(chunk._id.toString());
    } else {
      console.warn(`  ! No ingested chunk found for ${sourceFilename}#${chunkIndex} — check goldenSet.json / fixtures/`);
    }
  }
  return ids;
}

async function main() {
  console.log('Connecting to MongoDB and the vector store...');
  await connectDB();
  await vectorStore.init();

  const goldenSet = JSON.parse(await readFile(path.join(__dirname, 'goldenSet.json'), 'utf-8'));

  const user = await ensureEvalUser();
  const tenantId = user.tenantId.toString();

  console.log('Ensuring fixture documents are ingested for the eval tenant...');
  await ensureFixturesIngested(tenantId, goldenSet);

  const perQuestion = [];
  const retrievalScores = [];

  for (const item of goldenSet) {
    process.stdout.write(`Evaluating ${item.id}: "${item.question}" ... `);

    const expectedChunkIds = await resolveExpectedChunkIds(tenantId, item.expectedChunks);
    const { results } = await withRetryOn429(() => search({ tenantId, query: item.question }));
    const retrievedChunkIds = results.map((r) => r.chunkId);

    const retrieval = scoreRetrieval({ expectedChunkIds, retrievedChunkIds });
    retrievalScores.push(retrieval);

    const { answer } = await withRetryOn429(() => generateAnswer({ tenantId, query: item.question }));
    const faithfulness = await withRetryOn429(() =>
      scoreFaithfulness({
        question: item.question,
        answer,
        contextChunks: results.map((r) => r.text),
      })
    );

    // Cohere's free trial key caps rerank at 10 calls/min — pace requests so
    // we mostly avoid 429s rather than only reacting to them after the fact.
    await sleep(7000);

    perQuestion.push({
      id: item.id,
      question: item.question,
      precision: retrieval.precision,
      recall: retrieval.recall,
      faithful: faithfulness.faithful,
      unsupportedClaims: faithfulness.unsupportedClaims,
    });

    console.log(`P=${retrieval.precision.toFixed(2)} R=${retrieval.recall.toFixed(2)} faithful=${faithfulness.faithful}`);
  }

  const retrieval = aggregateRetrievalScores(retrievalScores);
  const faithfulCount = perQuestion.filter((q) => q.faithful).length;
  const faithfulness = { faithfulCount, total: perQuestion.length, faithfulRate: faithfulCount / perQuestion.length };

  const report = formatReport({ retrieval, faithfulness, perQuestion });
  const reportPath = path.join(__dirname, 'report.md');
  await writeFile(reportPath, report);

  console.log('\n' + report);
  console.log(`Full report written to ${reportPath}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Eval run failed:', err);
  process.exit(1);
});
