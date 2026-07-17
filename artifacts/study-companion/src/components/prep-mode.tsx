import { useState } from 'react';
import { useProcessPrep, getGetHistoryQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, ArrowRight, BookOpen, Target } from 'lucide-react';

function normalizeContent(content: unknown): string {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((item) => normalizeContent(item)).join('\n');
  if (typeof content === 'object') {
    return Object.entries(content as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${normalizeContent(v)}`)
      .join('\n');
  }
  return String(content);
}

export function PrepMode() {
  const [text, setText] = useState('');
  const processPrep = useProcessPrep();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<any>(null);

  const handleGenerate = () => {
    if (!text.trim()) return;
    setResult(null);
    processPrep.mutate({ data: { text } }, {
      onSuccess: (data) => {
        setResult(data.content);
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
      }
    });
  };

  return (
    <div className="flex flex-col gap-8 animate-reveal">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">Study Prep</h2>
        <p className="text-muted-foreground">Paste your transcript or reading material to generate instant study guides.</p>
      </div>

      <div className="flex flex-col gap-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text here... (e.g. historical context, lecture transcript, long article)"
          className="w-full min-h-[250px] p-6 rounded-3xl border border-border bg-card text-foreground font-mono text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground shadow-inner"
        />
        <button
          onClick={handleGenerate}
          disabled={!text.trim() || processPrep.isPending}
          className="self-end bg-primary text-primary-foreground px-8 py-3 rounded-full font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
        >
          {processPrep.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
          {processPrep.isPending ? 'Analyzing...' : 'Generate Prep Material'}
        </button>
      </div>

      {result && (
        <div className="grid gap-6">
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl animate-reveal delay-100">
            <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-primary/20 text-primary">
                <BookOpen className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm tracking-wide">Material Summary</h3>
            </div>
            <div className="p-6 text-sm whitespace-pre-wrap leading-relaxed text-card-foreground/90 font-mono">
              {normalizeContent(result.summary)}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl animate-reveal delay-200">
            <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-primary/20 text-primary">
                <Target className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm tracking-wide">Predicted Exam Questions</h3>
            </div>
            <div className="p-6 text-sm whitespace-pre-wrap leading-relaxed text-card-foreground/90 font-mono">
              {normalizeContent(result.questions)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
