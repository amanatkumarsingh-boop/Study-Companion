import { useState, useEffect } from 'react';
import { ClassMode } from '@/components/class-mode';
import { PrepMode } from '@/components/prep-mode';
import { FactCheckMode } from '@/components/fact-check-mode';
import { DoubtMode } from '@/components/doubt-mode';
import { HistoryFeed } from '@/components/history-feed';
import { cn } from '@/lib/utils';
import { BrainCircuit, Mic, BookOpen, ShieldCheck, HelpCircle, WifiOff } from 'lucide-react';

type Mode = 'class' | 'prep' | 'factcheck' | 'doubt';

const TABS: { id: Mode; label: string; icon: typeof Mic; color: string; bg: string }[] = [
  { id: 'class',     label: 'Class',      icon: Mic,         color: '#10B981', bg: '#10B98115' },
  { id: 'prep',      label: 'Prep',       icon: BookOpen,    color: '#8B5CF6', bg: '#8B5CF615' },
  { id: 'factcheck', label: 'Fact Check', icon: ShieldCheck, color: '#06B6D4', bg: '#06B6D415' },
  { id: 'doubt',     label: 'Doubt',      icon: HelpCircle,  color: '#F59E0B', bg: '#F59E0B15' },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>('class');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineDismissed, setOfflineDismissed] = useState(false);

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
              Please check your internet connection to continue using Class, Preparation, Fact Check, or Doubt modes.
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
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 container mx-auto max-w-4xl px-6 py-10 flex flex-col gap-16 pb-32">
        <section className="min-h-[400px]">
          {mode === 'class'     && <ClassMode />}
          {mode === 'prep'      && <PrepMode />}
          {mode === 'factcheck' && <FactCheckMode />}
          {mode === 'doubt'     && <DoubtMode />}
        </section>

        <section className="pt-12 border-t border-border/50 pb-4">
          <h2 className="text-base font-bold mb-6 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
            Recent Logs
          </h2>
          <HistoryFeed />
        </section>
      </main>

      {/* ── Bottom navigation bar ── */}
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
    </div>
  );
}
