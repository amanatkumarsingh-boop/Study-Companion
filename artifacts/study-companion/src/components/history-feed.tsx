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

  const getModeStyle = (mode: string) => {
    switch (mode) {
      case 'class':     return { emoji: '🎙️', label: 'Class',      color: '#10B981' };
      case 'prep':      return { emoji: '📖', label: 'Prep',       color: '#8B5CF6' };
      case 'factcheck': return { emoji: '🔍', label: 'Fact Check', color: '#06B6D4' };
      case 'doubt':     return { emoji: '💡', label: 'Doubt',      color: '#F59E0B' };
      default:          return { emoji: '📄', label: 'Log',        color: '#6B7280' };
    }
  };

  const normalizeStr = (val: unknown): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(' ');
    if (typeof val === 'object') return Object.values(val as Record<string, unknown>).join(' ');
    return String(val);
  };

  const getPreviewText = (entry: any) => {
    if (entry.mode === 'factcheck') {
      return entry.content.verdict
        ? `${entry.content.verdict}: ${normalizeStr(entry.content.explanation)}`
        : 'Fact check result';
    }
    if (entry.mode === 'doubt') {
      return normalizeStr(entry.content.answer) || 'Doubt answered';
    }
    return normalizeStr(entry.content.summary) || normalizeStr(entry.content.notes) || 'Processing generated materials...';
  };

  return (
    <div className="flex flex-col gap-4">
      {history.slice(0, 20).map((entry) => {
        const { emoji, label, color } = getModeStyle(entry.mode);
        const preview = getPreviewText(entry);

        return (
          <div key={entry.id} className="p-5 rounded-2xl border border-border bg-card hover:bg-muted/40 transition-colors flex flex-col gap-3 cursor-default shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none" aria-hidden="true">{emoji}</span>
                <span
                  className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border"
                  style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
                >
                  {label}
                </span>
              </div>
              <span className="text-xs font-mono text-muted-foreground/60">
                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm font-mono text-foreground/70 line-clamp-2 leading-relaxed">{preview}</p>
          </div>
        );
      })}
    </div>
  );
}
