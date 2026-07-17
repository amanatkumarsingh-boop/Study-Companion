import { useState } from 'react';
import { useProcessFactCheck, getGetHistoryQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FactCheckMode() {
  const [claim, setClaim] = useState('');
  const processFactCheck = useProcessFactCheck();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<any>(null);

  const handleCheck = () => {
    if (!claim.trim()) return;
    setResult(null);
    processFactCheck.mutate({ data: { claim } }, {
      onSuccess: (data) => {
        setResult(data.content);
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
      }
    });
  };

  return (
    <div className="flex flex-col gap-8 animate-reveal">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">Fact Check</h2>
        <p className="text-muted-foreground">Heard a wild claim in class? Paste it here for an instant verdict.</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
            placeholder="e.g. Napoleon was extremely short..."
            className="w-full pl-14 pr-6 py-4 rounded-full border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground shadow-inner font-mono"
          />
        </div>
        <button
          onClick={handleCheck}
          disabled={!claim.trim() || processFactCheck.isPending}
          className="bg-primary text-primary-foreground px-8 py-4 rounded-full font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
        >
          {processFactCheck.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify'}
        </button>
      </div>

      {result && (
        <div className="mt-4 animate-reveal">
          <div className={cn(
            "rounded-3xl border p-8 flex flex-col gap-5 shadow-2xl relative overflow-hidden",
            result.verdict === 'CORRECT' ? "bg-emerald-950/20 border-emerald-900/50" : "bg-rose-950/20 border-rose-900/50"
          )}>
            <div className={cn(
              "absolute -right-8 -top-8 opacity-10 pointer-events-none",
              result.verdict === 'CORRECT' ? "text-emerald-500" : "text-rose-500"
            )}>
              {result.verdict === 'CORRECT' ? <CheckCircle2 className="w-48 h-48" /> : <XCircle className="w-48 h-48" />}
            </div>
            
            <div className="flex items-center gap-4 relative z-10">
              {result.verdict === 'CORRECT' ? (
                <div className="p-2 bg-emerald-500/20 rounded-full text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              ) : (
                <div className="p-2 bg-rose-500/20 rounded-full text-rose-400">
                  <XCircle className="w-8 h-8" />
                </div>
              )}
              <h3 className={cn(
                "text-3xl font-black tracking-tight",
                result.verdict === 'CORRECT' ? "text-emerald-400" : "text-rose-400"
              )}>
                {result.verdict}
              </h3>
            </div>
            <p className="text-sm font-mono leading-relaxed text-foreground/80 relative z-10">
              {result.explanation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
