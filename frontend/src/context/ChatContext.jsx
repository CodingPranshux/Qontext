import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { getActiveConversation, clearActiveConversation } from '../lib/api.js';

const ChatContext = createContext(null);

function toTurn(persisted) {
  return {
    id: persisted.id,
    question: persisted.question,
    askedAt: new Date(persisted.askedAt),
    answer: persisted.answer,
    sources: persisted.sources || [],
    citedChunkIds: persisted.citedChunkIds || [],
    searched: true,
    retrievalQuery: persisted.retrievalQuery,
    rewritten: persisted.rewritten,
    latencyMs: persisted.latencyMs,
    status: persisted.status,
    error: persisted.error,
  };
}

/**
 * Holds the chat conversation above the router, not inside ChatPage — Routes
 * fully unmounts its route element on navigation, which was wiping the
 * conversation every time the user visited Documents and came back. Backed
 * by /api/conversations/active so it also survives a full page reload;
 * ChatPage persists each finished turn there as it completes (see its
 * onDone/onError handlers) — this context only owns hydrating on load and
 * clearing on "New Chat" (see CommandPalette's resetAt) or an account switch.
 */
export function ChatProvider({ children }) {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Clear synchronously on every token change (login/logout/account
    // switch) so a moment never exists where one account's messages are
    // still on screen while a different account's fetch is in flight.
    setMessages([]);

    if (!token) {
      setHydrated(false);
      return undefined;
    }

    let cancelled = false;
    getActiveConversation(token)
      .then(({ turns }) => {
        if (!cancelled) setMessages(turns.map(toTurn));
      })
      .catch(() => {
        // Best-effort — an empty local conversation is a safe fallback if
        // hydration fails (offline, server hiccup, etc.).
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });

    // Also guards React 18 StrictMode's dev-only double-invoke of this
    // effect (mount -> cleanup -> mount again): the first invocation's
    // fetch result is correctly discarded here instead of racing the
    // second invocation's fetch.
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function clearConversation() {
    setMessages([]);
    if (!token) return;
    try {
      await clearActiveConversation(token);
    } catch {
      // Best-effort — worst case the old conversation reappears on reload.
    }
  }

  return (
    <ChatContext.Provider value={{ messages, setMessages, hydrated, clearConversation }}>{children}</ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
