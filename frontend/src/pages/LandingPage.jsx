import { Link } from 'react-router-dom';
import { ArrowRight, Code2, GitCommitHorizontal, Shield, SearchCheck, Verified, RotateCw } from 'lucide-react';

const FEATURES = [
  {
    icon: GitCommitHorizontal,
    title: 'Deterministic Source Chunking',
    body: 'Hybrid BM25 and dense vector embeddings with metadata-preserved chunk boundaries and exact paragraph indexing.',
    spec: { label: 'chunk_overlap: 64t', value: 'BM25 + CohereV3', valueColor: '#22c55e', bar: '80%', barColor: '#3b82f6', note: 'Preserves AST nodes & markdown headers' },
  },
  {
    icon: Shield,
    title: 'Cryptographic Tenant Isolation',
    body: 'Complete partition of embeddings and vector indexes per tenant namespace. Zero cross-contamination risks by design.',
    spec: { label: 'tenant_key: kms:us-east', value: 'AES-256-GCM', valueColor: '#22c55e', bar: '100%', barColor: '#22c55e', note: 'Physical partition per tenant index space' },
  },
  {
    icon: SearchCheck,
    title: 'Inspectable Retrieval Traces',
    body: 'Transparent similarity metrics, cosine thresholds, and token attribution for every generated token.',
    spec: { label: 'attribution_entropy: 0.04', value: '100% auditable', valueColor: '#3b82f6', bar: '75%', barColor: '#3b82f6', note: 'Byte-level bounding boxes stored per run' },
  },
];

const BENCHMARK_ROWS = [
  { name: 'Qontext Hybrid + Reranker (Current)', current: true, map: '0.942', recall: '98.4%', latency: '42 ms', provenance: 'Exact Offset' },
  { name: 'Vanilla Dense Vectors (OpenAI text-embed-3)', map: '0.718', recall: '81.2%', latency: '120 ms', provenance: 'Chunk Only' },
  { name: 'Elasticsearch BM25 (Keyword Match)', map: '0.642', recall: '74.9%', latency: '28 ms', provenance: 'Document Only' },
  { name: 'Standard Graph-RAG Pipeline', map: '0.825', recall: '89.0%', latency: '420 ms', provenance: 'Node ID' },
];

function LandingPage() {
  return (
    <div className="w-full flex-1 bg-[#09090b]">
      {/* Hero */}
      <section className="w-full border-b border-[#27272a] bg-[#09090b] px-6 pb-20 pt-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#27272a] bg-[#18181b] px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22c55e]" />
            </span>
            <span className="font-code-sm text-xs text-[#a1a1aa]">
              Engine release: <strong>v1.4.2</strong> (Hybrid RRF enabled)
            </span>
          </div>

          <h1 className="mb-6 max-w-3xl font-display-lg text-display-lg font-normal tracking-tight text-[#fafafa] md:text-[56px] md:leading-[1.15]">
            Document intelligence grounded in your private infrastructure.
          </h1>

          <p className="mb-8 max-w-2xl font-body-lg text-body-lg leading-relaxed text-[#a1a1aa]">
            Qontext indexes your engineering documentation, specs, and source text into strictly isolated tenant
            vectors. Query with deterministic semantic citations down to the exact byte offset.
          </p>

          <div className="mb-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/signin?mode=signup"
              className="inline-flex items-center gap-2 rounded-lg bg-[#ffffff] px-5 py-2.5 text-sm font-medium text-[#09090b] shadow-sm transition-all hover:bg-[#e4e4e7]"
            >
              <span>Create Free Tenant</span>
              <ArrowRight size={16} />
            </Link>
            <a
              href="#architecture"
              className="inline-flex items-center gap-2 rounded-lg border border-[#27272a] bg-[#111113] px-5 py-2.5 text-sm font-medium text-[#fafafa] transition-all hover:border-[#3f3f46] hover:bg-[#18181b]"
            >
              <Code2 size={16} className="text-[#71717a]" />
              <span>Read API Reference</span>
            </a>
          </div>

          <p className="mt-2 font-code-sm text-xs tracking-wide text-[#71717a]">
            v1.4.2 · SOC2 Type II Certified · Tenant Data AES-256 GCM
          </p>

          {/* Product mockup */}
          <div className="mt-12 w-full overflow-hidden rounded-xl border border-[#27272a] bg-[#18181b] text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#27272a] bg-[#111113] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#27272a]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#27272a]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#27272a]" />
                <span className="ml-2 font-code-sm text-xs text-[#71717a]">runtime-query-session · tenant: acme-prod-01</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden font-code-sm text-xs text-[#71717a] sm:inline">p99: 42ms</span>
                <span className="h-3 w-px bg-[#27272a]" />
                <span className="flex items-center gap-1.5 font-code-sm text-xs text-[#22c55e]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" /> streaming
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <div className="flex justify-end">
                <div className="max-w-lg rounded-xl border border-[#27272a] bg-[#27272a]/60 px-4 py-3 text-sm text-[#fafafa] shadow-sm">
                  How do we handle idempotency keys when dispatching webhook payloads?
                </div>
              </div>
              <div className="flex items-center gap-2 px-1 py-1 font-code-sm text-xs text-[#3b82f6]">
                <RotateCw size={15} className="animate-spin" />
                <span>Searching 1,420 chunks across 14 documents… Found 3 relevant sources (similarity τ &gt; 0.88)</span>
              </div>
              <div className="flex flex-col gap-4 rounded-xl border border-[#27272a] bg-[#111113] p-5">
                <p className="text-sm leading-relaxed text-[#a1a1aa]">
                  Webhook dispatches require an{' '}
                  <span className="rounded bg-[#27272a] px-1.5 py-0.5 font-code-sm text-xs text-[#fafafa]">Idempotency-Key</span>{' '}
                  header derived from the SHA-256 hash of the payload and tenant salt{' '}
                  <span className="mx-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#3b82f6]/40 bg-[#3b82f6]/20 text-[10px] font-semibold text-[#3b82f6]">
                    1
                  </span>
                  . Keys persist in Redis with a 24-hour TTL; repeated calls within this window return cached responses
                  with the <span className="rounded bg-[#27272a] px-1.5 py-0.5 font-code-sm text-xs text-[#fafafa]">X-Cache: HIT</span> marker{' '}
                  <span className="mx-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#3b82f6]/40 bg-[#3b82f6]/20 text-[10px] font-semibold text-[#3b82f6]">
                    2
                  </span>
                  .
                </p>
                <div className="flex flex-wrap items-center gap-2.5 border-t border-[#27272a]/80 pt-3">
                  <span className="flex items-center gap-1.5 rounded-full border border-[#22c55e]/20 bg-[#22c55e]/10 px-2.5 py-1 font-code-sm text-xs text-[#22c55e]">
                    <Verified size={12} /> Grounded · 2 sources
                  </span>
                  <button className="flex items-center gap-1.5 rounded border border-[#27272a] bg-[#18181b] px-2.5 py-1 font-code-sm text-xs text-[#71717a] transition-colors hover:border-[#3f3f46] hover:text-[#fafafa]">
                    <span className="text-[#3b82f6]">[1]</span>
                    <span>webhooks_v2_spec.pdf</span>
                    <span className="text-[#52525b]">(chunk #42, score 0.94)</span>
                  </button>
                  <button className="flex items-center gap-1.5 rounded border border-[#27272a] bg-[#18181b] px-2.5 py-1 font-code-sm text-xs text-[#71717a] transition-colors hover:border-[#3f3f46] hover:text-[#fafafa]">
                    <span className="text-[#3b82f6]">[2]</span>
                    <span>redis_caching_layer.txt</span>
                    <span className="text-[#52525b]">(chunk #18, score 0.89)</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#27272a] bg-[#09090b] px-4 py-2 font-code-sm text-xs text-[#71717a]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" /> Vector Fetch: 18ms
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" /> Reranker: 14ms
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" /> First Token: 46ms
                </span>
              </div>
              <span className="text-[#52525b]">trace_id: tr_99a8f4c2e</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section id="features" className="w-full border-b border-[#27272a] bg-[#09090b] px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <span className="mb-2 block font-code-sm text-xs uppercase tracking-widest text-[#3b82f6]">
                Zero Hallucination Architecture
              </span>
              <h2 className="font-headline-lg text-headline-lg font-normal text-[#fafafa]">
                Engineered for deterministic retrieval
              </h2>
            </div>
            <p className="max-w-md font-body-md text-[#a1a1aa]">
              Standard RAG implementations break on dense codebases and complex RFCs. Qontext executes hybrid lexical
              and neural search with mathematically enforced isolation.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body, spec }) => (
              <div
                key={title}
                className="flex flex-col justify-between rounded-xl border border-[#27272a] bg-[#18181b] p-6 transition-all hover:border-[#3f3f46]"
              >
                <div>
                  <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-[#27272a] bg-[#111113] text-[#fafafa]">
                    <Icon size={20} />
                  </div>
                  <h3 className="mb-2 font-title-md text-title-md font-medium text-[#fafafa]">{title}</h3>
                  <p className="mb-6 font-body-md leading-relaxed text-[#a1a1aa]">{body}</p>
                </div>
                <div className="flex flex-col gap-1.5 rounded-lg border border-[#27272a] bg-[#111113] p-3 font-code-sm text-[11px] text-[#71717a]">
                  <div className="flex justify-between text-[#a1a1aa]">
                    <span>{spec.label}</span>
                    <span style={{ color: spec.valueColor }}>{spec.value}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#27272a]">
                    <div className="h-full" style={{ width: spec.bar, background: spec.barColor }} />
                  </div>
                  <span className="text-[#52525b]">{spec.note}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture deep dive */}
      <section id="architecture" className="w-full border-b border-[#27272a] bg-[#09090b] px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-2xl">
            <span className="mb-2 block font-code-sm text-xs uppercase tracking-widest text-[#71717a]">System Topology</span>
            <h2 className="mb-4 font-headline-lg text-headline-lg font-normal text-[#fafafa]">
              Sub-50ms retrieval pipeline architecture
            </h2>
            <p className="font-body-md text-[#a1a1aa]">
              Every document ingress undergoes automated AST parsing, semantic windowing, high-dimensional vector
              projection, and persistent disk-tier indexing.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="flex flex-col overflow-hidden rounded-xl border border-[#27272a] bg-[#18181b] lg:col-span-7">
              <div className="flex items-center justify-between border-b border-[#27272a] bg-[#111113] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-code-sm text-xs text-[#fafafa]">retrieval_pipeline.py</span>
                  <span className="rounded bg-[#27272a] px-1.5 py-0.5 font-code-sm text-[10px] text-[#71717a]">Python SDK</span>
                </div>
                <span className="font-code-sm text-xs text-[#71717a]">curl / grpc / typescript available</span>
              </div>
              <div className="overflow-x-auto bg-[#0e0e10] p-5 font-code-md text-xs leading-relaxed text-[#c2c6d6]">
                <pre>
                  <code>
                    <span className="text-[#71717a]"># 1. Initialize client with isolated tenant cryptographic keys</span>
                    {'\n'}
                    <span className="text-[#c0c1ff]">import</span> qontext{'\n\n'}
                    client = qontext.Client({'\n'}
                    {'    '}api_key=<span className="text-[#22c55e]">&quot;qon_live_8f0a221b9c...&quot;</span>,{'\n'}
                    {'    '}tenant_id=<span className="text-[#22c55e]">&quot;acme-prod-01&quot;</span>
                    {'\n'})
                    {'\n\n'}
                    <span className="text-[#71717a]"># 2. Query with deterministic thresholding and hybrid reranking</span>
                    {'\n'}
                    response = client.retrieve({'\n'}
                    {'    '}query=<span className="text-[#22c55e]">&quot;How do we handle idempotency keys when dispatching webhook payloads?&quot;</span>,{'\n'}
                    {'    '}top_k=<span className="text-[#adc6ff]">3</span>,{'\n'}
                    {'    '}min_similarity=<span className="text-[#adc6ff]">0.85</span>,{'\n'}
                    {'    '}rerank_model=<span className="text-[#22c55e]">&quot;rerank-multilingual-v3.0&quot;</span>,{'\n'}
                    {'    '}strict_provenance=<span className="text-[#c0c1ff]">True</span>
                    {'\n'})
                    {'\n\n'}
                    <span className="text-[#71717a]"># 3. Access exact token spans and byte ranges</span>
                    {'\n'}
                    <span className="text-[#c0c1ff]">for</span> match <span className="text-[#c0c1ff]">in</span> response.matches:{'\n'}
                    {'    '}print(f<span className="text-[#22c55e]">&quot;[{'{match.id}'}] score={'{match.score:.3f}'} range={'{match.byte_range}'}&quot;</span>)
                  </code>
                </pre>
              </div>
              <div className="flex items-center justify-between border-t border-[#27272a] bg-[#111113] p-4 font-code-sm text-xs text-[#71717a]">
                <span>Latency budget: &lt; 50ms (p95)</span>
                <span className="cursor-pointer text-[#3b82f6] hover:underline">View open source SDKs →</span>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-4 lg:col-span-5">
              <div className="rounded-xl border border-[#27272a] bg-[#18181b] p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-code-sm text-xs text-[#71717a]">HYBRID RECIPROCAL RANK FUSION</span>
                  <span className="font-code-sm text-xs text-[#22c55e]">+38% precision</span>
                </div>
                <div className="mb-1 font-metric-display text-metric-display text-[#fafafa]">0.962 nDCG@10</div>
                <p className="font-body-sm text-body-sm text-[#a1a1aa]">
                  Outperforms standard BM25 and vanilla vector search across technical documentation benchmarks
                  (SciFact &amp; CodeDoc benchmark suites).
                </p>
              </div>
              <div className="rounded-xl border border-[#27272a] bg-[#18181b] p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-code-sm text-xs text-[#71717a]">TENANT DATA INGEST THROUGHPUT</span>
                  <span className="font-code-sm text-xs text-[#3b82f6]">auto-sharded</span>
                </div>
                <div className="mb-1 font-metric-display text-metric-display text-[#fafafa]">45,000 p/min</div>
                <p className="font-body-sm text-body-sm text-[#a1a1aa]">
                  Real-time synchronization for Git repos, Notion workspaces, PDF specifications, and Confluence
                  spaces with delta compression.
                </p>
              </div>
              <div className="rounded-xl border border-[#27272a] bg-[#18181b] p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-code-sm text-xs text-[#71717a]">PROVENANCE PRECISION</span>
                  <span className="font-code-sm text-xs text-[#22c55e]">Exact match</span>
                </div>
                <div className="mb-1 font-metric-display text-metric-display text-[#fafafa]">0 Hallucination</div>
                <p className="font-body-sm text-body-sm text-[#a1a1aa]">
                  Every response token is mapped to a byte-offset in the target storage bucket. Uncited claims are
                  rejected at the inference gateway.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benchmarks table */}
      <section id="benchmarks" className="w-full border-b border-[#27272a] bg-[#09090b] px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <span className="mb-2 block font-code-sm text-xs uppercase tracking-widest text-[#3b82f6]">
              Empirical Validation
            </span>
            <h2 className="font-headline-lg text-headline-lg font-normal text-[#fafafa]">Retrieval evaluation benchmarks</h2>
            <p className="mt-2 font-body-md text-[#a1a1aa]">
              Tested against open-source technical corpora comprising 2.4M chunks of engineering RFCs and
              documentation.
            </p>
          </div>

          <div className="w-full overflow-hidden rounded-xl border border-[#27272a] bg-[#18181b]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm font-body-md">
                <thead>
                  <tr className="border-b border-[#27272a] bg-[#111113] font-code-sm text-[11px] uppercase tracking-wider text-[#71717a]">
                    <th className="px-4 py-3">Architecture Approach</th>
                    <th className="px-4 py-3">mAP @ 10</th>
                    <th className="px-4 py-3">Context Recall</th>
                    <th className="px-4 py-3">p99 Query Latency</th>
                    <th className="px-4 py-3">Byte Provenance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a] font-code-sm text-xs">
                  {BENCHMARK_ROWS.map((row) => (
                    <tr
                      key={row.name}
                      className={row.current ? 'bg-[#141417]/40 text-[#fafafa]' : 'text-[#a1a1aa] hover:bg-[#141417]/20'}
                    >
                      <td className="flex items-center gap-2 px-4 py-3.5 font-medium">
                        {row.current && <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" />}
                        {row.name}
                      </td>
                      <td className={`px-4 py-3.5 ${row.current ? 'font-semibold text-[#22c55e]' : ''}`}>{row.map}</td>
                      <td className={`px-4 py-3.5 ${row.current ? 'font-semibold text-[#22c55e]' : ''}`}>{row.recall}</td>
                      <td className={`px-4 py-3.5 ${row.current ? 'text-[#fafafa]' : ''}`}>{row.latency}</td>
                      <td className="px-4 py-3.5">
                        {row.current ? (
                          <span className="rounded bg-[#22c55e]/10 px-2 py-0.5 text-[#22c55e]">{row.provenance}</span>
                        ) : (
                          <span className="text-[#71717a]">{row.provenance}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="w-full bg-[#09090b] px-6 py-20">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-8 rounded-2xl border border-[#27272a] bg-[#18181b] p-8 md:flex-row md:p-12">
          <div>
            <h2 className="mb-2 font-headline-lg text-headline-lg font-normal text-[#fafafa]">
              Deploy your tenant namespace in under 60 seconds.
            </h2>
            <p className="max-w-lg font-body-md text-[#a1a1aa]">
              No credit card required for developer tier. Access our Python, TypeScript, and Go SDKs immediately with
              10,000 monthly queries included.
            </p>
          </div>
          <div className="flex w-full flex-col items-center gap-3 sm:flex-row md:w-auto">
            <Link
              to="/signin?mode=signup"
              className="w-full rounded-lg bg-[#ffffff] px-6 py-3 text-center text-sm font-medium text-[#09090b] shadow-sm transition-all hover:bg-[#e4e4e7] sm:w-auto"
            >
              Get Started Now
            </Link>
            <a
              href="#architecture"
              className="w-full rounded-lg border border-[#27272a] px-6 py-3 text-center text-sm font-medium text-[#fafafa] transition-all hover:border-[#3f3f46] hover:bg-[#111113] sm:w-auto"
            >
              Talk to an Engineer
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-[#27272a] bg-[#09090b] px-6 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-4">
            <span className="opacity-80">
              <div className="[&_span]:text-[#fafafa]">
                <LandingBrandMark />
              </div>
            </span>
            <span className="font-code-sm text-xs text-[#71717a]">© 2025 Qontext Inc. High-integrity vector retrieval.</span>
          </div>
          <div className="flex items-center gap-6 font-code-sm text-xs text-[#71717a]">
            <a href="#status" className="transition-colors hover:text-[#fafafa]">
              System Status
            </a>
            <a href="#security" className="transition-colors hover:text-[#fafafa]">
              SOC2 Security
            </a>
            <a href="#privacy" className="transition-colors hover:text-[#fafafa]">
              Privacy Policy
            </a>
            <a href="#terms" className="transition-colors hover:text-[#fafafa]">
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LandingBrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" className="h-7 w-7 shrink-0">
        <rect x="2" y="4" width="24" height="24" rx="6" fill="#18181b" stroke="#27272a" strokeWidth="1.5" />
        <circle cx="14" cy="16" r="6" stroke="#3b82f6" strokeWidth="2" />
        <path d="M14 10V22M10 16H18" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="19" cy="21" r="2" fill="#fafafa" />
      </svg>
      <span className="font-display text-base font-semibold">Qontext</span>
    </span>
  );
}

export default LandingPage;
