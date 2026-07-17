import { useGetHistory } from '@workspace/api-client-react';
import { formatDistanceToNow } from 'date-fns';

export function HistoryFeed() {
  const { data: history, isLoading, error } = useGetHistory();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-card border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
        Failed to load history feed. Ensure the server is running.
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-4 border border-dashed border-border rounded-2xl">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border border-border">
          <span className="text-xl opacity-50">👻</span>
        </div>
        <p className="text-sm font-medium">No recent logs found. Start studying!</p>
      </div>
    );
  }

  const getEmojiAndLabel = (mode: string) => {
    switch (mode) {
      case 'class': return { emoji: '🎙️', label: 'Class' };
      case 'prep': return { emoji: '📖', label: 'Prep' };
      case 'factcheck': return { emoji: '🔍', label: 'Fact Check' };
      default: return { emoji: '📄', label: 'Log' };
    }
  };

  const getPreviewText = (entry: any) => {
    if (entry.mode === 'factcheck') {
      return entry.content.verdict ? `${entry.content.verdict}: ${entry.content.explanation}` : 'Fact check result';
    }
    return entry.content.summary || entry.content.notes || 'Processing generated materials...';
  };

  return (
    <div className="flex flex-col gap-4">
      {history.slice(0, 20).map((entry) => {
        const { emoji, label } = getEmojiAndLabel(entry.mode);
        const preview = getPreviewText(entry);

        return (
          <div key={entry.id} className="p-5 rounded-2xl border border-border bg-card hover:bg-muted/40 transition-colors flex flex-col gap-3 group cursor-default shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none" aria-hidden="true">{emoji}</span>
                <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground bg-background px-2 py-0.5 rounded-full border border-border">{label}</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground/60">
                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm font-mono text-foreground/70 line-clamp-2 leading-relaxed">
              {preview}
            </p>
          </div>
        );
      })}
    </div>
  );
}
