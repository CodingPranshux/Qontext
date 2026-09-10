import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { LogOut, User, Command } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ChatProvider } from './context/ChatContext.jsx';
import Brand from './components/Brand.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import LandingPage from './pages/LandingPage.jsx';
import SignInPage from './pages/SignInPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import ChatPage from './pages/ChatPage.jsx';

const NAV_LINKS = [
  { to: '/upload', label: 'Documents', end: true },
  { to: '/chat', label: 'Chat', end: false },
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);

function TopBar({ onOpenPalette }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-outline-variant bg-surface/90 backdrop-blur-md">
      <div className="flex h-14 w-full items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Brand />

          <nav className="flex h-14 items-center gap-6">
            {NAV_LINKS.map(({ to, label, end }) => {
              const isActive = end ? location.pathname === to : location.pathname.startsWith(to);
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={`flex h-full items-center border-b-2 font-label-md text-label-md transition-colors duration-150 ${
                    isActive ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onOpenPalette}
            className="hidden items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1 font-code-sm text-code-sm text-outline transition-colors duration-150 hover:text-on-surface-variant sm:flex"
          >
            <Command size={13} />
            {isMac ? '⌘K' : 'Ctrl+K'}
          </button>
          <span className="hidden max-w-[180px] truncate font-code-sm text-code-sm text-on-surface-variant sm:inline">
            {user?.email}
          </span>
          <button
            type="button"
            title="Sign out"
            onClick={logout}
            className="flex items-center justify-center p-1 text-outline transition-colors duration-150 hover:text-on-surface"
          >
            <LogOut size={18} />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <User size={18} className="text-on-primary" />
          </div>
        </div>
      </div>
    </header>
  );
}

/** Marketing navbar for the public landing/sign-in pages — mirrors the Stitch landing screen header. */
function MarketingNavbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link to="/">
            <Brand />
          </Link>
          <nav className="hidden items-center gap-6 font-body-md text-sm text-[#a1a1aa] md:flex">
            <a href="/#features" className="transition-colors duration-150 hover:text-[#fafafa]">
              Features
            </a>
            <a href="/#architecture" className="transition-colors duration-150 hover:text-[#fafafa]">
              Architecture
            </a>
            <a href="/#benchmarks" className="transition-colors duration-150 hover:text-[#fafafa]">
              Benchmarks
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 rounded bg-[#111113] px-2.5 py-1 font-code-sm text-xs text-[#71717a] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
            <span>us-east-1 operational</span>
          </div>
          <Link to="/signin" className="px-2 py-1.5 text-sm font-body-md text-[#a1a1aa] transition-colors hover:text-[#fafafa]">
            Sign In
          </Link>
          <Link
            to="/signin?mode=signup"
            className="rounded-lg bg-[#ffffff] px-3.5 py-1.5 text-sm font-body-md font-medium text-[#09090b] transition-all hover:bg-[#e4e4e7] active:scale-[0.98]"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Gates a page behind auth: redirects to the sign-in page when logged out. */
function RequireAuth({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/signin" replace />;
  return children;
}

function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex min-h-0 flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}

function Shell() {
  const { token } = useAuth();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [token]);

  const isAuthPage = location.pathname === '/signin';

  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface">
      {token ? <TopBar onOpenPalette={() => setPaletteOpen(true)} /> : !isAuthPage && <MarketingNavbar />}
      {token && <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />}
      <div className={`flex min-h-0 flex-1 flex-col ${token ? 'pt-14' : ''}`}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={token ? <Navigate to="/upload" replace /> : <LandingPage />} />
            <Route path="/signin" element={token ? <Navigate to="/upload" replace /> : <SignInPage />} />
            <Route
              path="/upload"
              element={
                <RequireAuth>
                  <PageTransition>
                    <UploadPage />
                  </PageTransition>
                </RequireAuth>
              }
            />
            <Route
              path="/chat"
              element={
                <RequireAuth>
                  <PageTransition>
                    <ChatPage />
                  </PageTransition>
                </RequireAuth>
              }
            />
          </Routes>
        </AnimatePresence>
      </div>
    </div>
  );
}

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <ChatProvider>
          <BrowserRouter>
            <Shell />
          </BrowserRouter>
        </ChatProvider>
      </AuthProvider>
    </MotionConfig>
  );
}

export default App;
