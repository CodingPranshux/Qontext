import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, Bot, User, FileText, X, Sparkles } from 'lucide-react';
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
  const citedSources = turn.sources.filter((s) => turn.citedChunkIds.includes(s.chunkId));

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
          {turn.status === 'error' ? turn.error : turn.answer ? renderAnswer(turn.answer, turn.sources, onCiteClick) : <TypingDots />}
        </div>
      </div>

      {citedSources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pl-[2.625rem]">
          <span className="mr-0.5 text-xs text-text-tertiary">Sources</span>
          {citedSources.map((source, i) => (
            <motion.button
              key={source.chunkId}
              type="button"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: i * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onCiteClick(source)}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent transition-colors duration-150 hover:bg-accent/20"
            >
              <FileText size={11} />
              {source.sourceFilename}
            </motion.button>
          ))}
        </div>
      )}
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
      { id, question, answer: '', sources: [], citedChunkIds: [], status: 'streaming', error: null },
    ]);
    setQuery('');
    setLoading(true);

    try {
      await askQuestion({
        token,
        query: question,
        history,
        onSources: (sources) => updateTurn(id, (t) => ({ ...t, sources })),
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
