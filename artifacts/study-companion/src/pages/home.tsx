import { useState, useEffect } from 'react';
import { PrepMode } from '@/components/prep-mode';
import { FactCheckMode } from '@/components/fact-check-mode';
import { DoubtMode } from '@/components/doubt-mode';
import { HistoryFeed } from '@/components/history-feed';
import { AuthModal } from '@/components/auth-modal';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { BrainCircuit, BookOpen, ShieldCheck, HelpCircle, WifiOff, LogOut, UserRound } from 'lucide-react';

type Mode = 'prep' | 'factcheck' | 'doubt';

const TABS: { id: Mode; label: string; icon: typeof BookOpen; color: string; bg: string }[] = [
  { id: 'prep',      label: 'Prep',       icon: BookOpen,    color: '#8B5CF6', bg: '#8B5CF615' },
  { id: 'factcheck', label: 'Fact Check', icon: ShieldCheck, color: '#06B6D4', bg: '#06B6D415' },
  { id: 'doubt',     label: 'Doubt',      icon: HelpCircle,  color: '#F59E0B', bg: '#F59E0B15' },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>('prep');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineDismissed, setOfflineDismissed] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const { user, loading: authLoading, logout } = useAuth();

  useEffect(() => {
    const handleOnline  = () => { setIsOffline(false); setOfflineDismissed(false); };
    const handleOffline = () => { setIsOffline(true); };
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const activeTab = TABS.find((t) => t.id === mode)!;
  const showOfflineOverlay = isOffline && !offlineDismissed;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#0B0F19]">

      {/* ── Fullscreen offline overlay ── */}
      {showOfflineOverlay && (
        <div className="fixed inset-0 z-50 bg-[#0B0F19] flex flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shadow-[0_0_32px_#EF444430]">
            <WifiOff className="w-9 h-9 text-red-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">You're Offline</h1>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Please check your internet connection to continue using Preparation, Fact Check, or Doubt modes.
            </p>
          </div>
          <button
            onClick={() => setOfflineDismissed(true)}
            className="mt-2 px-6 py-2.5 rounded-full border border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          >
            View Past Logs →
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-[#0B0F19]/90 backdrop-blur-xl">
        <div className="container mx-auto max-w-4xl px-6 h-16 flex items-center gap-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center border shadow-inner"
            style={{ backgroundColor: `${activeTab.color}20`, borderColor: `${activeTab.color}40`, color: activeTab.color }}
          >
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-base leading-none">Study Companion</h1>
            <p className="text-[9px] text-muted-foreground font-mono mt-0.5 uppercase tracking-widest">Focused Session</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {authLoading ? (
              <span className="text-xs text-muted-foreground">Checking account…</span>
            ) : user ? (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-cyan-300/25 bg-cyan-300/10 text-xs font-bold text-cyan-200">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      (user.name?.[0] ?? user.email[0]).toUpperCase()
                    )}
                  </div>
                  <span className="hidden max-w-32 truncate text-xs text-slate-300 sm:block">
                    {user.name || user.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLogoutError('');
                    void logout().catch((error: unknown) => {
                      setLogoutError(error instanceof Error ? error.message : 'Unable to sign out.');
                    });
                  }}
                  aria-label="Sign out"
                  title="Sign out"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-slate-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-300/15"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
        {logoutError && (
          <p role="alert" className="mx-auto max-w-4xl px-6 pb-2 text-right text-xs text-red-300">
            {logoutError}
          </p>
        )}
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 container mx-auto max-w-4xl px-6 py-10 flex flex-col gap-16 pb-32">
        {authLoading ? (
          <section className="flex min-h-[400px] items-center justify-center text-sm text-muted-foreground">
            Checking your account…
          </section>
        ) : !user ? (
          <section className="flex min-h-[400px] flex-col items-center justify-center gap-5 rounded-3xl border border-white/10 bg-white/[0.025] px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              <UserRound className="h-6 w-6" />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-xl font-bold">Your study space, saved to your account</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Sign in to prepare notes, check a claim, or ask a doubt. Your activity and history stay private to your account.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              Sign in or create an account
            </button>
          </section>
        ) : (
          <>
            <section className="min-h-[400px]">
              {mode === 'prep' && <PrepMode />}
              {mode === 'factcheck' && <FactCheckMode />}
              {mode === 'doubt' && <DoubtMode />}
            </section>

            <section className="pt-12 border-t border-border/50 pb-4">
              <h2 className="text-base font-bold mb-6 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
                Recent Logs
              </h2>
              <HistoryFeed />
            </section>
          </>
        )}
      </main>

      {/* ── Bottom navigation bar ── */}
      {user && (
        <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-[#0B0F19]/95 backdrop-blur-xl">
          <div className="container mx-auto max-w-4xl px-2 flex items-stretch h-16">
            {TABS.map(({ id, label, icon: Icon, color, bg }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  className={cn(
                    'flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl mx-1 my-1.5 transition-all duration-200',
                    active ? '' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  )}
                  style={active ? { backgroundColor: bg, color } : {}}
                >
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
                  <span
                    className="text-[10px] font-bold tracking-wide"
                    style={active ? { color } : {}}
                  >
                    {label}
                  </span>
                  {active && (
                    <span
                      className="absolute bottom-1.5 w-1 h-1 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </div>
  );
}
