const APP_NAME = import.meta.env.VITE_APP_NAME || 'Qontext';

/** Wordmark shared across navbars/pages — mirrors the Stitch Qontext logo mark exactly. */
function Brand({ className = '', markOnly = false }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="h-8 w-8 shrink-0">
        <rect x="2" y="4" width="24" height="24" rx="6" fill="#18181b" stroke="#27272a" strokeWidth="1.5" />
        <circle cx="14" cy="16" r="6" stroke="#3b82f6" strokeWidth="2" />
        <path d="M14 10V22M10 16H18" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="19" cy="21" r="2" fill="#fafafa" />
      </svg>
      {!markOnly && (
        <span className="font-display text-[20px] font-semibold tracking-tight text-on-surface">{APP_NAME}</span>
      )}
    </span>
  );
}

export default Brand;
