import pgvector from 'pgvector/pg';
import { getPgPool } from '../../config/postgres.js';
import { config } from '../../config/index.js';

// Table name comes from server-side config (an env var set by the operator),
// never from request input, so interpolating it directly is safe here.
const TABLE = config.postgres.vectorTable;

async function init() {
  const pool = getPgPool();
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      chunk_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      embedding VECTOR(${config.vectorStore.dimensions}) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ${TABLE}_tenant_id_idx ON ${TABLE} (tenant_id)`);
}

async function upsertVector({ tenantId, chunkId, embedding }) {
  const pool = getPgPool();
  await pool.query(
    `INSERT INTO ${TABLE} (chunk_id, tenant_id, embedding)
     VALUES ($1, $2, $3)
     ON CONFLICT (chunk_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, embedding = EXCLUDED.embedding`,
    [chunkId, tenantId, pgvector.toSql(embedding)]
  );
}

// Direct tenant-filtered lookup. No similarity search yet (that's Phase 3) —
// this exists so tenant isolation can be verified at the storage layer itself.
async function findByTenant(tenantId) {
  const pool = getPgPool();
  const { rows } = await pool.query(`SELECT chunk_id, tenant_id FROM ${TABLE} WHERE tenant_id = $1`, [tenantId]);
  return rows.map((row) => ({ chunkId: row.chunk_id, tenantId: row.tenant_id }));
}

async function clearAll() {
  const pool = getPgPool();
  await pool.query(`TRUNCATE ${TABLE}`);
}

async function deleteByChunkIds(chunkIds) {
  if (chunkIds.length === 0) return;
  const pool = getPgPool();
  await pool.query(`DELETE FROM ${TABLE} WHERE chunk_id = ANY($1)`, [chunkIds]);
}

// Cosine similarity search (pgvector's <=> operator is cosine *distance*, so
// similarity = 1 - distance), always scoped to one tenant. This is Layer 3's
// vector-search leg of hybrid retrieval.
async function queryTopK({ tenantId, embedding, topK }) {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `SELECT chunk_id, 1 - (embedding <=> $1) AS score
     FROM ${TABLE}
     WHERE tenant_id = $2
     ORDER BY embedding <=> $1
     LIMIT $3`,
    [pgvector.toSql(embedding), tenantId, topK]
  );
  return rows.map((row) => ({ chunkId: row.chunk_id, score: Number(row.score) }));
}

export default { init, upsertVector, findByTenant, clearAll, queryTopK, deleteByChunkIds };
