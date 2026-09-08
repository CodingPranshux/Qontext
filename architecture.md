# Multi-Tenant RAG Platform — Architecture Spec

This is the reference spec for this project. Every build phase should be implemented
against this document. If an implementation detail isn't covered here, ask before
assuming.

## Tech Stack (decided — do not substitute without asking)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React | Upload UI, streaming chat UI with citation chips |
| Backend | Node.js / Express | Gateway + orchestration |
| Vector store | **pgvector** | One less system to operate alongside Postgres/Mongo/Redis; simpler ops story for a solo project. Tradeoff vs. Qdrant (faster purpose-built metadata filtering at scale) accepted knowingly. |
| Metadata / raw docs | MongoDB | Stores raw text + metadata per chunk |
| Cache | Redis | Semantic caching layer |
| Reranker | Small cross-encoder (hosted API) or LLM-as-reranker | Simpler first pass acceptable |
| Auth | JWT | tenant_id is derived from the token — never from client input |

> Fill in the vector store choice before Phase 2. Suggested reasoning to adapt:
> Qdrant = purpose-built, faster metadata filtering at scale. pgvector = one less
> system to operate if already on Postgres, easier ops story for a solo project.

## Layer 1 — Ingestion Pipeline (write path)

1. User uploads a file (PDF, docx, txt, etc.)
2. File is parsed by type into raw text
3. Text is split into overlapping chunks
   - Defend chunk size/overlap tradeoff: too small loses context, too large dilutes
     relevance. Start with ~500 tokens, ~50-token overlap, make it configurable.
4. Each chunk is embedded
5. Each chunk is written to **two places**, both tagged with `tenant_id`:
   - Vector store: embedding + minimal metadata (chunk_id, tenant_id)
   - MongoDB: raw chunk text + full metadata (source file, page/offset, chunk_id, tenant_id)

## Layer 2 — Storage Layer (multi-tenancy story)

- Every row/vector carries a `tenant_id`.
- Every read/write is filtered by `tenant_id`.
- **`tenant_id` is never trusted from client input** — it is derived server-side from
  the authenticated JWT on every request.
- Isolation model: **row-level filtering** (single collection/table, filtered by
  tenant_id) vs. **separate collections/schemas per tenant**. Pick row-level for this
  build (simpler, cheaper) but be ready to explain the tradeoff: separate
  collections give harder isolation guarantees and easier per-tenant scaling/deletion,
  at the cost of operational complexity as tenant count grows.

## Layer 3 — Query & Retrieval Pipeline (read path)

1. Incoming query is embedded
2. Hybrid search runs **in parallel**:
   - Vector similarity search (top-K from vector store)
   - BM25 keyword search (e.g. via MongoDB Atlas Search, or a lightweight BM25 lib)
3. Results are merged via **Reciprocal Rank Fusion (RRF)**
4. A **cross-encoder reranker** reorders the merged top-K for actual relevance
   before anything reaches the LLM
5. All of this is still filtered by `tenant_id` at every stage

This layer is the differentiator vs. tutorial-tier RAG — most builds skip BM25 and
reranking entirely.

## Layer 4 — Generation

1. Reranked top-K chunks + their citation metadata are passed to the LLM
2. Response streams back to the client over **SSE**
3. Each claim in the generated answer maps back to a specific source `chunk_id`, so
   citations are verifiable, not decorative

## Cross-Cutting Infra

- **Semantic caching**: cache by query *meaning* (embedding similarity above a
  threshold), not exact string match, so paraphrased queries hit cache. Redis-backed.
- **Per-tenant rate limiting**: token-bucket or similar, keyed by `tenant_id`, so one
  tenant can't starve others.
- **Eval harness**: a golden set of Q&A pairs (start with ~20–30). Score:
  - Retrieval precision/recall (did the right chunks come back?)
  - Answer faithfulness (does the generated answer only claim what's in the
    retrieved chunks?)
  - This is the single most differentiating addition — build it, even minimally.
- **Logging**: latency and cost per stage (embed, retrieve, rerank, generate), keyed
  by request ID and tenant_id.

## Build Order

Phases are additive — each assumes the previous is working and tested.

0. Repo scaffold (no business logic)
1. Auth + tenant_id derivation from JWT
2. Ingestion pipeline
3. Query & retrieval pipeline
4. Generation (LLM + citations + SSE streaming)
5. Cross-cutting infra (caching, rate limiting, eval harness, logging)

## Non-negotiables (apply to every phase)

- `tenant_id` is always derived server-side from the JWT, never accepted as a
  client parameter, in any endpoint, ever.
- Every DB/vector-store query includes a `tenant_id` filter — no exceptions, even
  in internal/admin tooling.
- Code should be understandable and explainable, not just working — this project
  exists to be discussed in an interview.
