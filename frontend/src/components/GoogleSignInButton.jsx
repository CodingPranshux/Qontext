import { useEffect, useRef } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.6 32.9 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 6 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35.1 26.9 36 24 36c-5.2 0-9.6-3.1-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.6 5.6C41.5 36.1 44 30.6 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

/**
 * Renders Google's own "Sign in with Google" button via Google Identity
 * Services (script tag in index.html) — Google requires the ID-token flow to
 * use its own rendered button rather than a custom-styled one. Falls back to
 * a disabled placeholder, matching the existing "coming soon" GitHub/SSO
 * buttons, when VITE_GOOGLE_CLIENT_ID isn't configured.
 */
function GoogleSignInButton({ onCredential, onError }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID || !containerRef.current) return undefined;

    let cancelled = false;

    // The GIS script loads async — poll briefly rather than assuming it's
    // ready by the time this component mounts.
    function tryInit() {
      if (cancelled) return;
      if (!window.google?.accounts?.id) {
        setTimeout(tryInit, 100);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => {
          if (response?.credential) onCredential(response.credential);
          else onError?.('Google sign-in did not return a credential');
        },
      });

      if (containerRef.current) {
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          width: 320,
          text: 'continue_with',
        });
      }
    }

    tryInit();
    return () => {
      cancelled = true;
    };
  }, [onCredential, onError]);

  if (!CLIENT_ID) {
    return (
      <button
        type="button"
        disabled
        title="Set VITE_GOOGLE_CLIENT_ID to enable"
        className="flex w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 font-label-md text-label-md text-on-surface opacity-60"
      >
        <GoogleIcon />
        <span>Continue with Google</span>
      </button>
    );
  }

  return <div ref={containerRef} className="flex w-full justify-center [&>div]:!w-full" />;
}

export default GoogleSignInButton;
