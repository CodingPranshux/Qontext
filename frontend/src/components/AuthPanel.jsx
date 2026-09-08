import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileStack, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import Button from './ui/Button.jsx';
import { cardClasses } from './ui/Card.jsx';

const TABS = [
  { id: 'login', label: 'Log in' },
  { id: 'signup', label: 'Sign up' },
];

function AuthPanel() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(email, password, tenantName);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={cardClasses({ className: 'w-full max-w-sm p-8' })}
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3.5 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-purple-500 text-bg shadow-glow">
            <FileStack size={20} />
          </div>
          <h1 className="text-[1.1rem] font-bold text-text">
            {mode === 'login' ? 'Welcome back' : 'Create your workspace'}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {mode === 'login'
              ? 'Log in to ask questions over your documents.'
              : 'Set up a tenant to start uploading documents.'}
          </p>
        </div>

        <div className="relative mb-5 flex rounded-lg bg-surface-2 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`relative flex-1 rounded-md py-2 text-sm font-semibold transition-colors duration-200 ${
                mode === tab.id ? 'text-text' : 'text-text-secondary hover:text-text'
              }`}
            >
              {mode === tab.id && (
                <motion.span
                  layoutId="auth-tab-pill"
                  className="absolute inset-0 rounded-md bg-surface shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>

        <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5 text-left">
            <label htmlFor="email" className="text-xs font-semibold text-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-all duration-150 placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div className="flex flex-col gap-1.5 text-left">
            <label htmlFor="password" className="text-xs font-semibold text-text-secondary">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-all duration-150 placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {mode === 'signup' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-1.5 text-left"
            >
              <label htmlFor="tenantName" className="text-xs font-semibold text-text-secondary">
                Workspace name
              </label>
              <input
                id="tenantName"
                type="text"
                placeholder="Acme Inc"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-all duration-150 placeholder:text-text-tertiary focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </motion.div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2.5 text-sm leading-snug text-danger">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" disabled={busy} className="mt-1 w-full">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create workspace'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

export default AuthPanel;
