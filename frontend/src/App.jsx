import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { FileStack, Upload, MessageCircle, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import AuthPanel from './components/AuthPanel.jsx';
import Button from './components/ui/Button.jsx';
import UploadPage from './pages/UploadPage.jsx';
import ChatPage from './pages/ChatPage.jsx';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'RAG Platform';

const NAV_LINKS = [
  { to: '/', label: 'Upload', icon: Upload, end: true },
  { to: '/chat', label: 'Chat', icon: MessageCircle, end: false },
];

function TopBar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-6 border-b border-border/80 bg-surface/70 px-6 backdrop-blur-md">
      <span className="flex items-center gap-2.5 text-[15px] font-bold text-text">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-purple-500 text-bg shadow-glow">
          <FileStack size={16} />
        </span>
        {APP_NAME}
      </span>

      <nav className="flex items-center gap-1">
        {NAV_LINKS.map(({ to, label, icon: Icon, end }) => {
          const isActive = end ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                isActive ? 'text-accent' : 'text-text-secondary hover:text-text'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-lg bg-accent/15"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon size={15} />
                {label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <span className="hidden max-w-[180px] truncate sm:inline">{user?.email}</span>
        <Button variant="ghost" icon title="Log out" onClick={logout}>
          <LogOut size={16} />
        </Button>
      </div>
    </header>
  );
}

/** Gates a page behind auth: shows the centered login/signup card when logged out. */
function RequireAuth({ children }) {
  const { token } = useAuth();
  if (!token) return <AuthPanel />;
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

  return (
    <div className="relative flex min-h-screen flex-col bg-bg text-text">
      {/* Aurora background: soft depth behind the flat page fill */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-accent/20 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-purple-500/15 blur-[120px]" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {token && <TopBar />}
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
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
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </AuthProvider>
    </MotionConfig>
  );
}

export default App;
