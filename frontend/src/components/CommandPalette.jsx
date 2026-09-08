import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, MessageSquarePlus, MessageCircle, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { cardClasses } from './ui/Card.jsx';

/**
 * Lightweight, hand-rolled command palette — a handful of fixed actions
 * doesn't warrant a fuzzy-search dependency. Mounted once for authed users
 * (App.jsx's Shell), toggled globally via Cmd/Ctrl+K.
 */
function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const actions = useMemo(() => {
    const base = [
      { id: 'documents', label: 'Go to Documents', icon: FileText, run: () => navigate('/upload') },
      { id: 'chat', label: 'Go to Chat', icon: MessageCircle, run: () => navigate('/chat') },
      { id: 'signout', label: 'Sign out', icon: LogOut, run: () => logout() },
    ];
    if (location.pathname.startsWith('/chat')) {
      base.splice(2, 0, {
        id: 'new-chat',
        label: 'New chat',
        icon: MessageSquarePlus,
        // ChatPage owns its own message state with no external reset hook yet —
        // a full navigate/remount is the simplest correct way to clear it.
        run: () => navigate('/chat', { replace: true, state: { resetAt: Date.now() } }),
      });
    }
    return base;
  }, [location.pathname, navigate, logout]);

  const filtered = useMemo(
    () => actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase())),
    [actions, query]
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function runAction(action) {
    if (!action) return;
    action.run();
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAction(filtered[activeIndex]);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-[1px]"
            onClick={onClose}
          />
          <motion.div
            key="palette"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cardClasses({ className: 'fixed left-1/2 top-[18vh] z-50 w-full max-w-md -translate-x-1/2 overflow-hidden' })}
            role="dialog"
            aria-label="Command palette"
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search actions..."
              className="w-full border-b border-outline-variant bg-transparent px-4 py-3 text-sm text-on-surface outline-none placeholder:text-outline"
            />
            <div className="max-h-64 overflow-y-auto py-1.5">
              {filtered.length === 0 && <p className="px-4 py-3 text-sm text-outline">No matching actions.</p>}
              {filtered.map(({ id, label, icon: Icon }, i) => (
                <button
                  key={id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => runAction(filtered[i])}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-100 ${
                    i === activeIndex ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant'
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default CommandPalette;
