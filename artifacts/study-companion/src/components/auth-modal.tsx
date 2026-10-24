import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context';

type GoogleIdentityApi = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
      }) => void;
      renderButton: (
        element: HTMLElement,
        options: { theme: 'filled_black'; size: 'large'; shape: 'pill'; width: number },
      ) => void;
      cancel: () => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const auth = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const googleButton = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !GOOGLE_CLIENT_ID || !googleButton.current) return;

    const host = googleButton.current;
    const renderGoogleButton = () => {
      if (!window.google || !host.isConnected) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (!response.credential) {
            setError('Google sign-in did not return a credential. Please try again.');
            return;
          }
          setBusy(true);
          setError('');
          void auth
            .signInWithGoogle(response.credential)
            .then(() => onOpenChange(false))
            .catch((cause: unknown) => {
              setError(cause instanceof Error ? cause.message : 'Google sign-in failed.');
            })
            .finally(() => setBusy(false));
        },
      });
      host.replaceChildren();
      window.google.accounts.id.renderButton(host, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        width: Math.min(360, Math.max(240, host.clientWidth)),
      });
    };

    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_SCRIPT_URL}"]`,
    );
    if (!script) {
      script = document.createElement('script');
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    if (window.google) {
      renderGoogleButton();
    } else {
      script.addEventListener('load', renderGoogleButton);
    }

    return () => {
      script?.removeEventListener('load', renderGoogleButton);
      window.google?.accounts.id.cancel();
    };
  }, [auth.signInWithGoogle, onOpenChange, open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');
    try {
      if (mode === 'register') {
        await auth.register(name, email, password);
      } else {
        await auth.signIn(email, password);
      }
      onOpenChange(false);
      setPassword('');
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setError('');
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-md border-white/10 bg-[#111827] text-white">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {mode === 'login'
              ? 'Sign in to continue your study sessions and access your history.'
              : 'Create an account to keep your study sessions and history together.'}
          </DialogDescription>
        </DialogHeader>

        <form className="mt-2 space-y-3" onSubmit={submit}>
          {mode === 'register' && (
            <Input
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              aria-label="Your name"
              maxLength={100}
              required
              className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
            />
          )}
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            aria-label="Email address"
            maxLength={254}
            required
            className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
          />
          <Input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === 'register' ? 'Password (8 characters minimum)' : 'Password'}
            aria-label="Password"
            minLength={mode === 'register' ? 8 : 1}
            maxLength={128}
            required
            className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
          />
          {error && (
            <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in with email'
                : 'Create account'}
          </button>
        </form>

        <div className="relative my-1 flex items-center">
          <span className="h-px flex-1 bg-white/10" />
          <span className="px-3 text-xs uppercase tracking-wider text-slate-500">or</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {GOOGLE_CLIENT_ID ? (
          <div ref={googleButton} className="flex min-h-11 justify-center" />
        ) : (
          <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-xs text-slate-400">
            Google sign-in will be available after its OAuth client ID is configured.
          </p>
        )}

        <p className="text-center text-sm text-slate-400">
          {mode === 'login' ? 'New to Study Companion?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            className="font-semibold text-cyan-300 hover:text-cyan-200"
          >
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
