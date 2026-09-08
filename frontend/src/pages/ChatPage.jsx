import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, Bot, User, FileText, X, Sparkles, Search, Database, ChevronDown, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { askQuestion } from '../lib/chatStream.js';
import { cardClasses } from '../components/ui/Card.jsx';

const CITATION_PATTERN = /\[chunk_id:\s*([^\]]+)\]/g;

const fadeUpVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

/**
 * Splits an answer into plain-text spans and clickable citation chips,
 * re-run on every render so a chip pops in the moment its closing "]"
 * streams in (a partial "[chunk_id: abc" just renders as plain text until then) —
 * animated distinctly (a spring pop) from the surrounding plain-text spans.
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
    const source = sources.find((s) => s.chunkId === chunkId);
    parts.push(
      <motion.button
        key={key++}
        type="button"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title={source ? `${source.sourceFilename} (chunk #${source.chunkIndex})` : 'Unknown source'}
        onClick={() => onCiteClick(source)}
        className="mx-0.5 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 align-middle text-[0.78em] font-semibold text-accent transition-colors duration-150 hover:bg-accent/25"
      >
        <FileText size={11} />
        {source ? source.sourceFilename : 'source'}
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
    <div className="flex items-center gap-2 text-text-secondary">
      <Search size={14} className="animate-pulse motion-reduce:animate-none" />
      <span className="text-[0.92rem] leading-relaxed">
        {rewritten && retrievalQuery ? <>Searching your documents for &ldquo;{retrievalQuery}&rdquo;…</> : 'Searching your documents…'}
      </span>
    </div>
  );
}

/**
 * Makes the RAG pipeline's work visible instead of hiding it behind a chat
 * bubble: whether the answer actually grounded on the tenant's documents
 * (vs. general knowledge), and — expandable — every candidate chunk that
 * survived retrieval + rerank with its relevance score, not just the ones
 * the model ended up citing.
 */
function RetrievalTrace({ turn, onCiteClick }) {
  const [open, setOpen] = useState(false);
  if (!turn.searched) return null;

  const grounded = turn.citedChunkIds.length > 0;

  return (
    <div className="flex flex-col gap-2 pl-[2.625rem]">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
            grounded ? 'bg-success/10 text-success' : 'bg-surface-2 text-text-tertiary'
          )}
        >
          {grounded ? <Database size={11} /> : <Sparkles size={11} />}
          {grounded
            ? `Grounded · ${turn.citedChunkIds.length} source${turn.citedChunkIds.length === 1 ? '' : 's'}`
            : 'General knowledge'}
        </span>

        {turn.sources.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-text-tertiary transition-colors duration-150 hover:bg-surface-2 hover:text-text-secondary"
          >
            Retrieval trace ({turn.sources.length})
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }}>
              <ChevronDown size={12} />
            </motion.span>
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={clsx(cardClasses({}), 'mt-1 flex flex-col divide-y divide-border')}>
              {turn.rewritten && turn.retrievalQuery && (
                <div className="px-3 py-2 text-xs text-text-tertiary">
                  Searched for: <span className="text-text-secondary">&ldquo;{turn.retrievalQuery}&rdquo;</span>
                </div>
              )}
              {turn.sources.map((source) => {
                const cited = turn.citedChunkIds.includes(source.chunkId);
                const pct = Math.round((source.rerankScore ?? 0) * 100);
                return (
                  <button
                    type="button"
                    key={source.chunkId}
                    onClick={() => onCiteClick(source)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-text-tertiary">
                      <FileText size={12} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-text-secondary">
                        {source.sourceFilename} <span className="text-text-tertiary">· chunk #{source.chunkIndex}</span>
                      </div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={clsx('h-full rounded-full', cited ? 'bg-accent' : 'bg-text-tertiary/40')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-text-tertiary">{pct}%</span>
                    {cited && <CheckCircle2 size={13} className="shrink-0 text-success" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-tertiary motion-reduce:animate-none"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '1s' }}
        />
      ))}
    </span>
  );
}

function Turn({ turn, onCiteClick }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex flex-col gap-3"
    >
      <div className="flex justify-end gap-2.5">
        <div className="max-w-[640px] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[0.92rem] leading-relaxed text-bg">
          {turn.question}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-secondary">
          <User size={15} />
        </div>
      </div>

      <div className="flex gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-purple-500 text-bg">
          <Bot size={15} />
        </div>
        <div
          className={clsx(
            'max-w-[640px] whitespace-pre-wrap px-4 py-2.5 text-[0.92rem] leading-relaxed',
            turn.status === 'error'
              ? 'rounded-2xl rounded-bl-md bg-danger/10 text-danger'
              : clsx(cardClasses({}), 'rounded-2xl rounded-bl-md')
          )}
        >
          {turn.status === 'error' ? (
            turn.error
          ) : !turn.searched ? (
            <SearchingIndicator retrievalQuery={turn.retrievalQuery} rewritten={turn.rewritten} />
          ) : turn.answer ? (
            renderAnswer(turn.answer, turn.sources, onCiteClick)
          ) : (
            <TypingDots />
          )}
        </div>
      </div>

      {turn.status !== 'error' && <RetrievalTrace turn={turn} onCiteClick={onCiteClick} />}
    </motion.div>
  );
}

function ChatPage() {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  function updateTurn(id, updater) {
    setMessages((prev) => prev.map((t) => (t.id === id ? updater(t) : t)));
  }

  async function handleAsk(e) {
    e.preventDefault();
    const question = query.trim();
    if (!question || loading) return;

    // Prior completed turns, flattened into the {role, content} shape the
    // backend expects — this is what lets follow-ups ("what about X?") work.
    const history = messages
      .filter((t) => t.status === 'done')
      .flatMap((t) => [
        { role: 'user', content: t.question },
        { role: 'assistant', content: t.answer },
      ]);

    const id = `${Date.now()}-${Math.random()}`;
    setMessages((prev) => [
      ...prev,
      {
        id,
        question,
        answer: '',
        sources: [],
        citedChunkIds: [],
        searched: false,
        retrievalQuery: null,
        rewritten: false,
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
        onRetrieval: ({ query: retrievalQuery, rewritten }) =>
          updateTurn(id, (t) => ({ ...t, retrievalQuery, rewritten })),
        onSources: (sources) => updateTurn(id, (t) => ({ ...t, sources, searched: true })),
        onToken: (chunk) => updateTurn(id, (t) => ({ ...t, answer: t.answer + chunk })),
        onDone: (citedChunkIds) => updateTurn(id, (t) => ({ ...t, citedChunkIds, status: 'done' })),
        onError: (message) => updateTurn(id, (t) => ({ ...t, status: 'error', error: message })),
      });
    } catch (err) {
      updateTurn(id, (t) => ({ ...t, status: 'error', error: err.message }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col px-6">
      {messages.length === 0 ? (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
        >
          <div className="relative mb-1 flex h-14 w-14 items-center justify-center">
            <span className="absolute inset-0 animate-pulse-glow rounded-full bg-accent/30 blur-2xl motion-reduce:animate-none" />
            <span className="relative flex h-14 w-14 animate-icon-breathe items-center justify-center rounded-full bg-gradient-to-br from-accent to-purple-500 text-bg shadow-glow motion-reduce:animate-none">
              <Sparkles size={22} />
            </span>
          </div>
          <motion.h2 variants={fadeUpVariants} className="text-lg font-semibold text-text">
            Ask me anything
          </motion.h2>
          <motion.p variants={fadeUpVariants} className="max-w-sm text-sm text-text-tertiary">
            I'll answer from your uploaded documents when they're relevant — with citations back to the source —
            and chat normally otherwise.
          </motion.p>
        </motion.div>
      ) : (
        <div className="flex-1 overflow-y-auto py-6">
          <div className="flex flex-col gap-6">
            <AnimatePresence initial={false}>
              {messages.map((turn) => (
                <Turn key={turn.id} turn={turn} onCiteClick={setSelectedSource} />
              ))}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      <div className="border-t border-border py-4 pb-6">
        <form
          onSubmit={handleAsk}
          className="flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pl-4 pr-1.5 shadow-sm transition-colors duration-200 focus-within:border-accent focus-within:shadow-glow"
        >
          <input
            type="text"
            placeholder="Ask a question about your documents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            className="flex-1 bg-transparent py-2 text-sm text-text outline-none placeholder:text-text-tertiary disabled:opacity-60"
          />
          <motion.button
            type="submit"
            whileTap={{ scale: 0.9 }}
            disabled={loading || !query.trim()}
            aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-bg transition-colors duration-200 hover:bg-accent-hover disabled:opacity-40"
          >
            <Send size={16} />
          </motion.button>
        </form>
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
              className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-[2px]"
              onClick={() => setSelectedSource(null)}
            />
            <motion.div
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-border bg-surface shadow-2xl"
            >
              <div className="flex items-start gap-3 border-b border-border p-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-secondary">
                  <FileText size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-text">{selectedSource.sourceFilename}</h3>
                  <p className="text-xs text-text-tertiary">Chunk #{selectedSource.chunkIndex}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSource(null)}
                  className="rounded-lg p-2 text-text-secondary transition-colors duration-150 hover:bg-surface-2 hover:text-text"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto whitespace-pre-wrap p-5 text-sm leading-relaxed text-text-secondary">
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
