import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Github,
  Loader2,
  Lock,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import GoogleSignInButton from './GoogleSignInButton.jsx';

function slugify(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function AuthPanel({ initialMode = 'login' }) {
  const { login, signup, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('acme-corp');
  const [showPassword, setShowPassword] = useState(false);
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

  const handleGoogleCredential = useCallback(
    async (idToken) => {
      setError(null);
      setBusy(true);
      try {
        await loginWithGoogle(idToken);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [loginWithGoogle]
  );

  const handleGoogleError = useCallback((message) => setError(message), []);

  return mode === 'login' ? (
    <LoginView
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      error={error}
      busy={busy}
      onSubmit={handleSubmit}
      onSwitchMode={() => setMode('signup')}
      onGoogleCredential={handleGoogleCredential}
      onGoogleError={handleGoogleError}
    />
  ) : (
    <SignupView
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      tenantName={tenantName}
      setTenantName={setTenantName}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      error={error}
      busy={busy}
      onSubmit={handleSubmit}
      onSwitchMode={() => setMode('login')}
      onGoogleCredential={handleGoogleCredential}
      onGoogleError={handleGoogleError}
    />
  );
}

/** Mirrors the Stitch "Sign In" screen exactly (M3 token palette). */
function LoginView({
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  error,
  busy,
  onSubmit,
  onSwitchMode,
  onGoogleCredential,
  onGoogleError,
}) {
  return (
    <div className="relative flex w-full flex-1 flex-col items-center justify-between px-4 py-8">
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden">
        <div className="h-[480px] w-[720px] rounded-full bg-primary/5 opacity-40 blur-3xl" />
        <div className="-mt-32 h-[360px] w-[360px] rounded-full bg-secondary-container/10 opacity-30 blur-2xl" />
      </div>

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between py-4">
        <Link to="/" className="flex items-center gap-3 transition-transform duration-150 active:scale-95">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="h-8 w-8">
            <rect x="2" y="4" width="24" height="24" rx="6" fill="#18181b" stroke="#27272a" strokeWidth="1.5" />
            <circle cx="14" cy="16" r="6" stroke="#3b82f6" strokeWidth="2" />
            <path d="M14 10V22M10 16H18" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="19" cy="21" r="2" fill="#fafafa" />
          </svg>
          <span className="hidden rounded-full border border-outline-variant/30 bg-surface-container-high px-2 py-0.5 font-code-sm text-code-sm uppercase tracking-widest text-outline sm:inline-block">
            v2.4.1-rc
          </span>
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          <ArrowLeft size={16} />
          <span>Back to home</span>
        </Link>
      </header>

      <main className="my-auto w-full max-w-md py-8">
        <div className="relative rounded-xl border border-outline-variant/40 bg-surface-container-low p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container px-2.5 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="font-code-sm text-code-sm uppercase tracking-tight text-on-surface-variant">Cluster US-EAST-01</span>
            </div>
            <span className="font-code-sm text-code-sm text-outline">PORT 443</span>
          </div>

          <div className="mb-6">
            <h1 className="font-headline-md text-headline-md font-normal tracking-tight text-on-surface">Sign in to Qontext</h1>
            <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
              Enter your developer credentials to access your tenant workspace.
            </p>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label htmlFor="email" className="mb-1.5 block font-label-md text-label-md font-medium text-on-surface">
                Work Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-3.5 py-2.5 font-body-md text-body-md text-on-surface transition-colors placeholder:text-outline focus:border-primary focus:outline-none"
                />
                <div className="pointer-events-none absolute right-3 top-2.5 text-outline">
                  <AtSign size={18} />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="font-label-md text-label-md font-medium text-on-surface">
                  Password
                </label>
                <span className="font-label-md text-label-md text-primary">Forgot password?</span>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-3.5 py-2.5 font-code-md text-code-md tracking-widest text-on-surface transition-colors placeholder:text-outline focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-2.5 text-outline transition-colors hover:text-on-surface focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-error-container/30 px-3 py-2.5 text-sm leading-snug text-on-error-container">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-on-background py-2.5 font-title-sm text-title-sm font-medium text-surface transition-all hover:bg-inverse-surface active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <span>Sign In</span>}
              {!busy && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="relative my-6 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant/40" />
            </div>
            <span className="relative bg-surface-container-low px-3 font-code-sm text-code-sm uppercase tracking-wider text-outline">
              Or continue with
            </span>
          </div>

          <div className="space-y-2.5">
            <GoogleSignInButton onCredential={onGoogleCredential} onError={onGoogleError} />
            <button
              type="button"
              disabled
              title="Coming soon"
              className="flex w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 font-label-md text-label-md text-on-surface opacity-60"
            >
              <Github size={16} />
              <span>Continue with GitHub</span>
            </button>
          </div>

          <div className="mt-6 text-center font-body-sm text-body-sm text-on-surface-variant">
            Don&apos;t have an account?{' '}
            <button type="button" onClick={onSwitchMode} className="ml-1 font-medium text-primary hover:underline">
              Create a tenant workspace
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-1.5">
          <div className="inline-flex items-center gap-2 font-code-sm text-code-sm text-outline">
            <ShieldCheck size={14} />
            <span>Encrypted via TLS 1.3 · Single Tenant Isolation</span>
          </div>
          <div className="text-center font-code-sm text-code-sm text-outline-variant/80">
            Zero persistent telemetry · SOC2 Type II Certified Pipeline
          </div>
        </div>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 border-t border-outline-variant/20 pt-6 sm:flex-row">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="font-code-sm text-code-sm text-outline">Vector Indexing: OPERATIONAL</span>
          </div>
          <span className="text-outline-variant">/</span>
          <div className="font-code-sm text-code-sm text-outline">
            p99: <span className="text-on-surface">18.4ms</span>
          </div>
        </div>
        <div className="flex items-center gap-6 font-code-sm text-code-sm text-outline">
          <span>Docs</span>
          <span>Status</span>
          <span>Privacy</span>
          <span>Support</span>
        </div>
      </footer>
    </div>
  );
}

/** Mirrors the Stitch "Sign Up" screen exactly (raw zinc/blue brand palette). */
function SignupView({
  email,
  setEmail,
  password,
  setPassword,
  tenantName,
  setTenantName,
  showPassword,
  setShowPassword,
  error,
  busy,
  onSubmit,
  onSwitchMode,
  onGoogleCredential,
  onGoogleError,
}) {
  return (
    <div className="relative flex w-full flex-1 flex-col justify-between bg-[#09090b] text-[#fafafa] selection:bg-[#3b82f6] selection:text-[#ffffff]">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-0 h-[350px] w-[700px] -translate-x-1/2 bg-gradient-to-b from-[#3b82f6]/10 via-transparent to-transparent blur-3xl" />

      <header className="relative z-10 flex w-full items-center justify-between border-b border-[#27272a] bg-[#09090b]/80 px-6 py-5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" className="h-7 w-7">
            <rect x="2" y="4" width="24" height="24" rx="6" fill="#18181b" stroke="#27272a" strokeWidth="1.5" />
            <circle cx="14" cy="16" r="6" stroke="#3b82f6" strokeWidth="2" />
            <path d="M14 10V22M10 16H18" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="19" cy="21" r="2" fill="#fafafa" />
          </svg>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#27272a] bg-[#18181b] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#a1a1aa]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22c55e]" />
            v2.4.0 Engine
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#71717a]">Already registered?</span>
          <button
            type="button"
            onClick={onSwitchMode}
            className="font-medium text-[#fafafa] underline decoration-[#27272a] underline-offset-4 transition-colors hover:text-[#3b82f6] hover:decoration-[#3b82f6]"
          >
            Sign in
          </button>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-3 flex items-center justify-between px-2 font-mono text-[11px] text-[#71717a]">
            <span className="flex items-center gap-1.5">
              <Database size={14} className="text-[#3b82f6]" />
              <span>TENANT_ISOLATION: STRICT</span>
            </span>
            <span className="text-[#52525b]">ZERO_RETENTION_VEC</span>
          </div>

          <div className="relative w-full overflow-hidden rounded-xl border border-[#27272a] bg-[#18181b] p-8 shadow-2xl backdrop-blur-sm">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3b82f6]/40 to-transparent" />

            <div className="mb-6">
              <h1 className="font-display text-2xl font-normal leading-tight tracking-tight text-[#fafafa]">
                Create your tenant workspace
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#a1a1aa]">
                Set up isolated document retrieval for your engineering organization.
              </p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <label htmlFor="tenant-id" className="mb-1.5 block text-xs font-medium text-[#fafafa]">
                  Organization / Tenant Identifier
                </label>
                <div className="relative">
                  <input
                    id="tenant-id"
                    type="text"
                    value={tenantName}
                    onChange={(e) => setTenantName(slugify(e.target.value))}
                    placeholder="acme-corp"
                    required
                    className="w-full rounded-lg border border-[#27272a] bg-[#111113] px-3.5 py-2.5 font-mono text-sm text-[#fafafa] placeholder-[#52525b] transition-all focus:border-[#3b82f6] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
                  />
                  <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center">
                    <CheckCircle2 size={14} className="text-[#22c55e]" />
                  </div>
                </div>
                <p className="mt-1.5 flex items-center gap-1 truncate font-mono text-[11px] text-[#71717a]">
                  <span className="text-[#52525b]">Partition URI:</span>
                  <span className="text-[#a1a1aa]">qontext.app/{tenantName || 'org-name'}</span>
                </p>
              </div>

              <div>
                <label htmlFor="signup-email" className="mb-1.5 block text-xs font-medium text-[#fafafa]">
                  Work Email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#27272a] bg-[#111113] px-3.5 py-2.5 text-sm text-[#fafafa] placeholder-[#52525b] transition-all focus:border-[#3b82f6] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="signup-password" className="text-xs font-medium text-[#fafafa]">
                    Password
                  </label>
                  <span className="font-mono text-[11px] text-[#71717a]">12+ chars</span>
                </div>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={12}
                    placeholder="Minimum 12 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-[#27272a] bg-[#111113] px-3.5 py-2.5 text-sm text-[#fafafa] placeholder-[#52525b] transition-all focus:border-[#3b82f6] focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
                  />
                  <button
                    type="button"
                    aria-label="Toggle password visibility"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] transition-colors hover:text-[#fafafa] focus:outline-none"
                  >
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-[#93000a]/20 px-3 py-2.5 text-sm leading-snug text-[#ffdad6]">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#ffffff] py-2.5 text-sm font-semibold text-[#09090b] shadow-sm transition-all duration-150 hover:bg-[#e4e4e7] active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <span>Create Workspace &amp; Get API Key</span>}
                  {!busy && <ArrowRight size={16} />}
                </button>
              </div>

              <p className="mt-4 text-center text-[11px] leading-normal text-[#71717a]">
                By creating a tenant, you agree to the{' '}
                <span className="underline hover:text-[#a1a1aa]">Enterprise Service Agreement</span> and{' '}
                <span className="underline hover:text-[#a1a1aa]">Data Processing Addendum</span>.
              </p>
            </form>

            <div className="relative my-6 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#27272a]" />
              </div>
              <span className="relative bg-[#18181b] px-3 text-[11px] uppercase tracking-wider text-[#71717a]">Or continue with</span>
            </div>

            <GoogleSignInButton onCredential={onGoogleCredential} onError={onGoogleError} />

            <div className="my-6 border-t border-[#27272a]" />

            <div className="rounded-lg border border-[#27272a] bg-[#111113] p-3">
              <div className="flex items-center justify-between font-mono text-[11px] text-[#a1a1aa]">
                <span className="text-[#71717a]">Vector Engine:</span>
                <span>HNSW Cosine · 1536d</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-[#a1a1aa]">
                <span className="text-[#71717a]">Cold-Start SLA:</span>
                <span className="text-[#22c55e]">&lt; 14ms Global</span>
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-[#a1a1aa]">
              Already have a tenant?{' '}
              <button type="button" onClick={onSwitchMode} className="font-medium text-[#3b82f6] hover:underline">
                Sign in
              </button>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 font-mono text-[11px] text-[#52525b]">
            <div className="flex items-center gap-1.5">
              <Lock size={14} />
              <span>SOC-2 TYPE II COMPLIANT</span>
            </div>
            <span className="text-[#27272a]">/</span>
            <div className="flex items-center gap-1.5">
              <Shield size={14} />
              <span>HIPAA READY BAA</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="z-10 flex w-full flex-col items-center justify-between gap-2 border-t border-[#27272a] bg-[#09090b] px-6 py-3 font-mono text-[11px] text-[#71717a] sm:flex-row">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
            <span className="text-[#a1a1aa]">All Vector Nodes Operational</span>
          </span>
          <span className="text-[#27272a]">|</span>
          <span>
            Cluster Latency: <strong className="font-normal text-[#fafafa]">4.2ms</strong>
          </span>
        </div>
        <div className="flex items-center gap-4 text-[#52525b]">
          <span>Documentation</span>
          <span>Security Architecture</span>
          <span>System Status</span>
        </div>
      </footer>
    </div>
  );
}

export default AuthPanel;
