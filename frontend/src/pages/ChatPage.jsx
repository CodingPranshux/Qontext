import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Send,
  FileText,
  X,
  ChevronRight,
  Database,
  Sparkles,
  CheckCircle2,
  MessageSquare,
  Copy,
  Code2,
  ThumbsUp,
  ThumbsDown,
  Filter,
  CircleCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { askQuestion } from '../lib/chatStream.js';
import { listDocuments, appendTurn } from '../lib/api.js';

const CITATION_PATTERN = /\[chunk_id:\s*([^\]]+)\]/g;

const SUGGESTED_PROMPTS = [
  'What documents do I have indexed?',
  'Summarize the most recently uploaded file.',
  'What sources back up your last answer?',
];

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

/**
 * Splits an answer into plain-text spans and numbered citation markers
 * (matching the source's position in `sources`, so marker "2" and retrieval-
 * trace row "2" are the same chunk), re-run on every render so a marker pops
 * in the moment its closing "]" streams in.
 */
function renderAnswer(text, sources, onCiteClick) {
  const parts = [];
  let lastIndex = 0;
  let key = 0;
  let match;

  CITATION_PATTERN.lastIndex = 0;
  while ((match = CITATION_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }

    const chunkId = match[1];
    const sourceIndex = sources.findIndex((s) => s.chunkId === chunkId);
    const source = sourceIndex >= 0 ? sources[sourceIndex] : null;
    parts.push(
      <motion.button
        key={key++}
        type="button"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        title={source ? `${source.sourceFilename} (chunk #${source.chunkIndex})` : 'Unknown source'}
        onClick={() => onCiteClick(source)}
        className="mx-0.5 inline-flex h-5 w-5 shrink-0 -translate-y-0.5 items-center justify-center rounded-full border border-primary/40 bg-surface-container text-[11px] font-semibold font-code-sm text-primary shadow-sm transition-all hover:border-primary hover:bg-primary/10"
      >
        {sourceIndex >= 0 ? sourceIndex + 1 : '?'}
      </motion.button>
    );

    lastIndex = CITATION_PATTERN.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return parts;
}

function SearchingIndicator({ retrievalQuery, rewritten }) {
  return (
    <div className="my-2 flex items-center gap-2 font-code-sm text-code-sm text-primary">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <span>
        {rewritten && retrievalQuery ? <>Searching for &ldquo;{retrievalQuery}&rdquo;…</> : 'Searching your documents…'}
      </span>
    </div>
  );
}

function FoundSourcesIndicator({ sources }) {
  const count = sources.length;
  return (
    <div className="flex items-center gap-2 font-code-sm text-code-sm text-on-surface-variant">
      <Sparkles size={14} className="animate-pulse motion-reduce:animate-none" />
      <span>{count > 0 ? `Found ${count} source${count === 1 ? '' : 's'} — answering…` : 'Answering from general knowledge…'}</span>
    </div>
  );
}

/** Makes the RAG pipeline's work visible: whether the answer grounded on tenant documents, and every candidate chunk that survived retrieval + rerank. */
function RetrievalTrace({ turn, onCiteClick }) {
  const [open, setOpen] = useState(true);
  if (!turn.searched) return null;

  const grounded = turn.citedChunkIds.length > 0;

  return (
    <div className="mt-5 space-y-3 border-t border-outline-variant/60 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-highest px-2.5 py-0.5 font-code-sm text-code-sm text-on-surface">
          <span className={clsx('h-1.5 w-1.5 rounded-full', grounded ? 'bg-success' : 'bg-outline')} />
          <span className={clsx('font-medium', grounded && 'text-success')}>{grounded ? 'Grounded' : 'General knowledge'}</span>
          {grounded && (
            <>
              <span className="text-outline-variant">·</span>
              <span className="text-on-surface-variant">
                {turn.citedChunkIds.length} source{turn.citedChunkIds.length === 1 ? '' : 's'} cited
              </span>
            </>
          )}
        </div>
        {turn.latencyMs != null && (
          <div className="flex items-center gap-3 font-code-sm text-code-sm text-outline">
            <span>Retrieval: {turn.latencyMs}ms</span>
          </div>
        )}
      </div>

      {turn.sources.length > 0 && (
        <div className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest/60 transition-all">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex w-full select-none items-center justify-between gap-2 p-3 font-code-sm text-code-sm text-outline transition-colors hover:text-on-surface"
          >
            <span className="flex items-center gap-2">
              <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }} className="text-primary">
                <ChevronRight size={16} />
              </motion.span>
              <span className="font-medium text-on-surface">Retrieval trace</span>
              <span className="text-on-surface-variant">({turn.sources.length} chunks analyzed)</span>
            </span>
          </button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-2.5 px-3 pb-3 pt-1">
                  {turn.rewritten && turn.retrievalQuery && (
                    <div className="text-[11px] text-on-surface-variant">
                      Searched for: <span className="text-on-surface">&ldquo;{turn.retrievalQuery}&rdquo;</span>
                    </div>
                  )}
                  {turn.sources.map((source, i) => {
                    const cited = turn.citedChunkIds.includes(source.chunkId);
                    const pct = Math.round((source.rerankScore ?? 0) * 100);
                    return (
                      <button
                        type="button"
                        key={source.chunkId}
                        id={`citation-card-${i + 1}`}
                        onClick={() => onCiteClick(source)}
                        className="w-full rounded border border-outline-variant bg-surface-container p-3 text-left font-code-sm text-code-sm transition-all duration-300 hover:border-primary/40"
                      >
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                              {i + 1}
                            </span>
                            <span className="font-medium text-on-surface">{source.sourceFilename}</span>
                            <span className="text-outline-variant">·</span>
                            <span className="text-outline">Chunk #{source.chunkIndex}</span>
                          </div>
                          <span className="rounded border border-primary/20 bg-surface-container-highest px-1.5 py-0.5 text-[10px] text-primary">
                            sim: {(source.rerankScore ?? 0).toFixed(3)}
                          </span>
                        </div>
                        <div className="rounded border border-outline-variant/30 bg-surface-container-lowest/80 p-2 leading-normal text-on-surface-variant">
                          &ldquo;{(source.text || '').slice(0, 220)}
                          {(source.text || '').length > 220 ? '…' : ''}&rdquo;
                        </div>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-container-highest">
                          <div className={clsx('h-full rounded-full', cited ? 'bg-primary' : 'bg-outline/40')} style={{ width: `${pct}%` }} />
                        </div>
                        {cited && (
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-success">
                            <CheckCircle2 size={11} /> Cited in answer
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function Turn({ turn, userEmail, onCiteClick }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }} className="pt-2">
      {/* User message */}
      <div className="flex flex-col items-end">
        <div className="ml-auto max-w-xl rounded-2xl rounded-tr-sm border border-outline-variant bg-surface-container p-4 shadow-sm transition-colors hover:border-outline/50">
          <p className="select-text font-body-md text-body-md leading-relaxed text-on-surface">{turn.question}</p>
        </div>
        <div className="mr-1 mt-1.5 flex items-center gap-1.5 font-code-sm text-code-sm text-outline">
          <span>{formatTime(turn.askedAt)}</span>
          <span className="text-outline-variant">·</span>
          <span>{userEmail}</span>
        </div>
      </div>

      {!turn.searched && <SearchingIndicator retrievalQuery={turn.retrievalQuery} rewritten={turn.rewritten} />}

      {/* Assistant response */}
      {(turn.searched || turn.status === 'error') && (
        <div className="mt-2 flex flex-col items-start">
          <div
            className={clsx(
              'max-w-3xl rounded-2xl rounded-tl-sm border p-5 shadow-sm',
              turn.status === 'error' ? 'border-error/40 bg-error-container/20 text-on-error-container' : 'border-outline-variant bg-surface-container-low'
            )}
          >
            {turn.status === 'error' ? (
              <p className="font-body-md text-body-md">{turn.error}</p>
            ) : turn.answer ? (
              <div className="select-text whitespace-pre-wrap font-body-md text-body-md leading-relaxed text-on-surface">
                {renderAnswer(turn.answer, turn.sources, onCiteClick)}
                {turn.status === 'streaming' && <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-primary align-middle" />}
              </div>
            ) : (
              <FoundSourcesIndicator sources={turn.sources} />
            )}

            {turn.status !== 'error' && turn.answer && <RetrievalTrace turn={turn} onCiteClick={onCiteClick} />}
          </div>

          {turn.status === 'done' && (
            <div className="ml-1 mt-1 flex items-center gap-2 font-code-sm text-code-sm text-outline">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(turn.answer)}
                className="flex items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-surface-container hover:text-on-surface"
              >
                <Copy size={14} />
                <span>Copy</span>
              </button>
              <button type="button" className="flex items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-surface-container hover:text-on-surface">
                <Code2 size={14} />
                <span>JSON Trace</span>
              </button>
              <button type="button" title="Vote helpful" className="flex items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-surface-container hover:text-on-surface">
                <ThumbsUp size={14} />
              </button>
              <button type="button" title="Vote unhelpful" className="flex items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-surface-container hover:text-on-surface">
                <ThumbsDown size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function ChatPage() {
  const { token, user } = useAuth();
  const location = useLocation();
  const { messages, setMessages, clearConversation } = useChat();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [indexStats, setIndexStats] = useState({ docCount: 0, chunkCount: 0 });
  const bottomRef = useRef(null);

  useEffect(() => {
    if (location.state?.resetAt) clearConversation();
  }, [location.state?.resetAt]);

  useEffect(() => {
    let cancelled = false;
    listDocuments(token)
      .then(({ documents }) => {
        if (cancelled) return;
        const ready = documents.filter((d) => d.status === 'ready');
        setIndexStats({
          docCount: ready.length,
          chunkCount: ready.reduce((sum, d) => sum + (d.chunkCount || 0), 0),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  function updateTurn(id, updater) {
    setMessages((prev) => prev.map((t) => (t.id === id ? updater(t) : t)));
  }

  /** Best-effort save of one finished turn — a failure here shouldn't affect the already-rendered answer. */
  function persistTurn(turn) {
    appendTurn({ token, turn }).catch(() => {});
  }

  async function submitQuestion(question) {
    if (!question || loading) return;

    const history = messages
      .filter((t) => t.status === 'done')
      .flatMap((t) => [
        { role: 'user', content: t.question },
        { role: 'assistant', content: t.answer },
      ]);

    const id = `${Date.now()}-${Math.random()}`;
    const askedAt = new Date();
    const startedAt = performance.now();

    // Mirrors what's pushed into `messages` below, so the finished turn can
    // be persisted from these local values instead of racing React's async
    // state updates to read the just-settled turn back out.
    const turnData = { question, askedAt, answer: '', sources: [], citedChunkIds: [], retrievalQuery: null, rewritten: false, latencyMs: null };

    setMessages((prev) => [
      ...prev,
      {
        id,
        ...turnData,
        searched: false,
        status: 'streaming',
        error: null,
      },
    ]);
    setQuery('');
    setLoading(true);

    try {
      await askQuestion({
        token,
        query: question,
        history,
        onRetrieval: ({ query: retrievalQuery, rewritten }) => {
          turnData.retrievalQuery = retrievalQuery;
          turnData.rewritten = rewritten;
          updateTurn(id, (t) => ({ ...t, retrievalQuery, rewritten }));
        },
        onSources: (sources) => {
          turnData.sources = sources;
          turnData.latencyMs = Math.round(performance.now() - startedAt);
          updateTurn(id, (t) => ({ ...t, sources, searched: true, latencyMs: turnData.latencyMs }));
        },
        onToken: (chunk) => {
          turnData.answer += chunk;
          updateTurn(id, (t) => ({ ...t, answer: t.answer + chunk }));
        },
        onDone: (citedChunkIds) => {
          turnData.citedChunkIds = citedChunkIds;
          updateTurn(id, (t) => ({ ...t, citedChunkIds, status: 'done' }));
          persistTurn({ ...turnData, status: 'done', error: null });
        },
        onError: (message) => {
          updateTurn(id, (t) => ({ ...t, status: 'error', error: message }));
          persistTurn({ ...turnData, status: 'error', error: message });
        },
      });
    } catch (err) {
      updateTurn(id, (t) => ({ ...t, status: 'error', error: err.message }));
      persistTurn({ ...turnData, status: 'error', error: err.message });
    } finally {
      setLoading(false);
    }
  }

  function handleAsk(e) {
    e.preventDefault();
    submitQuestion(query.trim());
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 sm:px-6">
      {/* Index status notice */}
      <div className="my-2 flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/40 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          <span className="font-code-sm text-code-sm text-on-surface-variant">
            {indexStats.docCount > 0 ? (
              <>
                Querying across <span className="text-on-surface">{indexStats.docCount} indexed document{indexStats.docCount === 1 ? '' : 's'}</span> (
                {indexStats.chunkCount} chunks)
              </>
            ) : (
              'No documents indexed yet'
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 font-code-sm text-code-sm text-outline">
          <Database size={14} />
          <span>hybrid + rerank</span>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-md border border-outline-variant bg-surface-container text-primary">
            <MessageSquare size={22} />
          </div>
          <h2 className="font-headline-sm text-headline-sm font-normal text-on-surface">Ask me anything</h2>
          <p className="max-w-sm font-body-md text-body-md text-on-surface-variant">
            I&apos;ll answer from your uploaded documents when they&apos;re relevant — with citations back to the source — and
            chat normally otherwise.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-2 pr-1 sm:pr-2">
          <div className="flex flex-col gap-1">
            <AnimatePresence initial={false}>
              {messages.map((turn) => (
                <Turn key={turn.id} turn={turn} userEmail={user?.email} onCiteClick={setSelectedSource} />
              ))}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      <div className="pb-6 pt-2">
        <div className="mb-1 flex items-center gap-2 overflow-x-auto pb-2">
          <span className="shrink-0 font-code-sm text-code-sm text-outline">Suggested:</span>
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => submitQuestion(p)}
              disabled={loading}
              className="shrink-0 rounded-full border border-outline-variant bg-surface-container px-2.5 py-1 font-code-sm text-code-sm text-on-surface-variant transition-all hover:border-outline hover:text-on-surface disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleAsk}
          className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container p-2 shadow-md transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary sm:gap-3 sm:p-2.5"
        >
          <button
            type="button"
            title="Manage context filter"
            className="flex shrink-0 items-center justify-center rounded-lg p-1.5 text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <Filter size={20} />
          </button>
          <input
            type="text"
            placeholder="Ask a question about your documents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            className="w-full flex-1 bg-transparent px-1 py-1 font-body-md text-body-md text-on-surface outline-none placeholder:text-outline disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            aria-label="Send"
            className="flex shrink-0 items-center justify-center rounded-lg bg-primary p-2.5 text-on-primary shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </form>
        <p className="mb-1 mt-2.5 select-none text-center font-code-sm text-code-sm text-outline">
          Answers are grounded strictly in your tenant&apos;s uploaded files. Numbered chips link to exact chunks.
        </p>
      </div>

      <AnimatePresence>
        {selectedSource && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-30 bg-background/70 backdrop-blur-[2px]"
              onClick={() => setSelectedSource(null)}
            />
            <motion.div
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-outline-variant bg-surface shadow-card"
            >
              <div className="flex items-start gap-3 border-b border-outline-variant p-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
                  <FileText size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-on-surface">{selectedSource.sourceFilename}</h3>
                  <p className="flex items-center gap-1 text-xs text-outline">
                    Chunk #{selectedSource.chunkIndex}
                    {selectedSource.rerankScore != null && (
                      <>
                        <CircleCheck size={11} className="ml-1.5 text-success" />
                        sim {selectedSource.rerankScore.toFixed(3)}
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSource(null)}
                  className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto whitespace-pre-wrap p-5 text-sm leading-relaxed text-on-surface-variant">
                {selectedSource.text}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ChatPage;
