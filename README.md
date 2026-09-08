# Multi-Tenant RAG Platform

Reference implementation is spec'd in [`ARCHITECTURE.md`](./ARCHITECTURE.md). This is
**Phase 0 — repo scaffold only**: folder structure, config wiring, and a health-check
endpoint. No auth, ingestion, retrieval, or generation logic yet.

## Repo layout

This is an **npm workspaces monorepo** (single root `package.json` with `workspaces:
["backend", "frontend"]`), not two independent packages. Reasoning: one `npm install`
at the root sets up both apps, dependency versions are visible from one place, and it's
easy to add shared code (e.g. a shared `types`/`schemas` package) later if tenant/chunk
shapes need to be shared between frontend and backend. The cost — workspaces add a
little indirection to `npm run` — is small for a two-app solo project.

```
.
├── backend/     Node.js + Express API (gateway + orchestration)
├── frontend/    React app (Vite) — upload UI + chat UI
├── ARCHITECTURE.md
└── package.json Workspace root
```

### backend/

```
backend/src/
├── config/       Centralized env/config access (config/index.js)
├── routes/       Express routers, mounted under /api
├── controllers/  Request handlers (thin — validation + calling services)
├── services/     Business logic (ingestion, retrieval, generation — Phase 2+)
├── models/       Data access / schemas (Mongo + pgvector — Phase 2+)
├── middleware/   Express middleware (error handling now; auth/rate-limit later)
├── app.js        Express app assembly
└── server.js     Entry point
```

### frontend/

```
frontend/src/
├── pages/
│   ├── UploadPage.jsx   Placeholder — document upload (Phase 2)
│   └── ChatPage.jsx     Placeholder — streaming chat + citations (Phase 4)
├── components/          Shared UI components (empty for now)
├── App.jsx              Router (Upload / Chat)
└── main.jsx             Entry point
```

## Stack decisions (see ARCHITECTURE.md for full detail)

- **Vector store: pgvector** — chosen over Qdrant to avoid operating an extra service
  alongside Postgres/Mongo/Redis. See ARCHITECTURE.md's tech stack table for the
  tradeoff writeup.
- **Metadata / raw docs: MongoDB**, **Cache: Redis**, **Auth: JWT** (`tenant_id` always
  derived server-side from the token, never from client input).

## Setup

### Prerequisites

- Node.js 18+
- npm 9+ (workspaces support)
- Docker Desktop (for Postgres+pgvector, MongoDB, and Redis — see below). Not required
  to run the Phase 0 scaffold or the automated test suite, both of which use in-memory
  test doubles instead.

### Install

From the repo root (installs both workspaces):

```bash
npm install
```

### Start local infrastructure

`docker-compose.yml` at the repo root brings up Postgres (with the `pgvector`
extension preinstalled, via the `pgvector/pgvector:pg16` image), MongoDB, and Redis,
each with a named volume so data survives restarts:

```bash
docker compose up -d
docker compose ps   # all three should show "healthy"
```

### Configure environment variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

`backend/.env.example`'s defaults for `MONGODB_URI`, `POSTGRES_URL`, and `REDIS_URL`
already point at the Docker Compose services above (`localhost:27017` /
`localhost:5432` / `localhost:6379`) — only `JWT_SECRET` and the three API keys need
filling in:

- **`JWT_SECRET`** — any random string, e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- **`EMBEDDING_API_KEY`** — a Gemini key. Get one at
  [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — free tier, no
  card required (1,500 requests/day).
- **`LLM_API_KEY`** — a Groq key. Get one at
  [console.groq.com/keys](https://console.groq.com/keys) — free tier, no card required
  (30 req/min, 14,400 req/day). Groq's API is OpenAI-compatible, serving open models
  (Llama 3.3 by default here) at very low latency.
- **`RERANKER_API_KEY`** — a Cohere key. Get one at
  [dashboard.cohere.com/api-keys](https://dashboard.cohere.com/api-keys) — free trial
  tier, no card required (1,000 calls/month).

All three providers above are free with no card on file, so the entire stack —
including the eval harness — runs at $0. (An earlier version of this README pointed
`EMBEDDING_API_KEY`/`LLM_API_KEY` at OpenAI; that was swapped out because OpenAI's API
requires a funded account even at its lowest usage tier.)

The vector store, semantic cache, and Postgres/Mongo connections have all been
verified against these local containers directly (schema creation, round-trip
read/write) — see "Run the eval harness" below for the one part that additionally
needs the API keys.

### Run

```bash
# Backend — http://localhost:5000
npm run dev:backend

# Frontend — http://localhost:5173
npm run dev:frontend
```

### Verify

```bash
curl http://localhost:5000/api/health
```

Should return:

```json
{ "status": "ok", "uptime": 12.3, "timestamp": "..." }
```

### Run tests

```bash
npm run test:backend
```

Uses `mongodb-memory-server` (no real MongoDB needed), an in-memory vector-store driver
(no real Postgres needed — `backend/src/models/vectorStore/`), and an in-memory
semantic-cache driver (no real Redis needed — `backend/src/infra/cache/`). The real
`pgvector`/`redis` drivers are what run in dev/prod.

### Run the eval harness

```bash
npm run eval --workspace backend
```

Needs a working `.env` with real MongoDB/Postgres/OpenAI/Cohere credentials — unlike
the vitest suite, this exercises the real embedding/rerank/LLM APIs on purpose, to
score actual retrieval and answer quality rather than plumbing correctness. See
`backend/eval/README.md`.

## Build order

See ARCHITECTURE.md → "Build Order". Done: Phase 0 (scaffold), Phase 1 (auth +
`tenant_id` derivation), Phase 2 (ingestion pipeline), Phase 3 (hybrid retrieval: vector
search + BM25 in parallel, merged with Reciprocal Rank Fusion, reranked with a hosted
cross-encoder), Phase 4 (generation: OpenAI chat completion streamed over SSE, with
verified `chunk_id` citations, plus a chat UI with clickable citation chips), Phase 5
(cross-cutting infra, all in `backend/src/infra/` — kept separate from the Phase 2-4
pipeline code rather than woven into it):
- **Semantic cache** (`infra/cache/`): Redis-backed (in-memory driver for tests),
  keyed by embedding similarity above a threshold and scoped by `tenant_id`, checked
  before retrieval runs.
- **Per-tenant rate limiting** (`infra/rateLimit/` + `middleware/rateLimit.middleware.js`):
  a token bucket per `tenant_id` on the query/chat endpoints.
- **Eval harness** (`backend/eval/`): a 25-question golden set, retrieval
  precision/recall/F1 scoring, and LLM-as-judge answer faithfulness scoring, rendered
  as a Markdown report.
- **Logging** (`infra/logging/`): per-stage (embed/cache/retrieve/rerank/generate)
  latency and estimated cost, tagged with `request_id` + `tenant_id` via
  `AsyncLocalStorage`, as JSON lines to console (and optionally `LOG_FILE`).

Next up: none — all 5 phases from ARCHITECTURE.md are implemented.
