import { useState } from 'react';
import { OfflineBanner } from '@/components/offline-banner';
import { ClassMode } from '@/components/class-mode';
import { PrepMode } from '@/components/prep-mode';
import { FactCheckMode } from '@/components/fact-check-mode';
import { HistoryFeed } from '@/components/history-feed';
import { cn } from '@/lib/utils';
import { BrainCircuit } from 'lucide-react';

type Mode = 'class' | 'prep' | 'factcheck';

export default function Home() {
  const [mode, setMode] = useState<Mode>('class');

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <OfflineBanner />
      
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto max-w-4xl px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-inner">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-lg leading-none">Study Companion</h1>
              <p className="text-[10px] text-muted-foreground font-mono mt-1 uppercase tracking-widest">Focused Session</p>
            </div>
          </div>
          <nav className="flex items-center gap-1 bg-muted/30 p-1.5 rounded-full border border-border/50">
            <TabButton active={mode === 'class'} onClick={() => setMode('class')}>Class</TabButton>
            <TabButton active={mode === 'prep'} onClick={() => setMode('prep')}>Prep</TabButton>
            <TabButton active={mode === 'factcheck'} onClick={() => setMode('factcheck')}>Fact Check</TabButton>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-4xl px-6 py-12 flex flex-col gap-16">
        <section className="min-h-[400px]">
          {mode === 'class' && <ClassMode />}
          {mode === 'prep' && <PrepMode />}
          {mode === 'factcheck' && <FactCheckMode />}
        </section>

        <section className="pt-12 border-t border-border/50 mt-auto pb-12">
          <h2 className="text-lg font-bold mb-8 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
            Recent Logs
          </h2>
          <HistoryFeed />
        </section>
      </main>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-5 py-2 rounded-full text-sm font-bold transition-all duration-300",
        active ? "bg-background text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
      )}
    >
      {children}
    </button>
  );
}
