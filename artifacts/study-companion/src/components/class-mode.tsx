import { useState, useRef, useEffect } from 'react';
import { useProcessClass, getGetHistoryQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Mic, Square, Loader2, Sparkles, Target, Quote } from 'lucide-react';

export function ClassMode() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const queryClient = useQueryClient();
  const processClass = useProcessClass();

  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript(prev => prev + ' ' + finalTranscript);
        }
      };
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };
      recognition.onend = () => {
        setIsRecording(false);
      };
      recognitionRef.current = recognition;
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      if (transcript.trim()) {
        processClass.mutate({ data: { transcript } }, {
          onSuccess: (data) => {
            setResult(data.content);
            queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
          }
        });
      }
    } else {
      setTranscript('');
      setResult(null);
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-reveal">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">Live Class Capture</h2>
        <p className="text-muted-foreground">Record your lecture to generate a summary, notes, and key questions.</p>
      </div>

      <div className="relative rounded-3xl border border-border bg-card p-8 min-h-[280px] flex flex-col items-center justify-center overflow-hidden shadow-2xl">
        {isRecording && (
          <div className="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none" />
        )}
        
        <button
          onClick={toggleRecording}
          disabled={processClass.isPending}
          className={cn(
            "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 shadow-lg",
            isRecording 
              ? "bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30" 
              : "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30",
            processClass.isPending && "opacity-50 cursor-not-allowed"
          )}
        >
          {processClass.isPending ? (
            <Loader2 className="w-10 h-10 animate-spin" />
          ) : isRecording ? (
            <Square className="w-10 h-10 fill-current" />
          ) : (
            <Mic className="w-10 h-10" />
          )}
        </button>

        <p className="mt-6 text-sm font-medium tracking-wide">
          {processClass.isPending 
            ? "Synthesizing materials..." 
            : isRecording 
              ? "Recording... Tap to stop & process" 
              : "Tap to begin recording"}
        </p>

        {transcript && (
          <div className="w-full mt-10 pt-6 border-t border-border/50">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Live Transcript
            </h3>
            <p className="text-sm font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {transcript}
            </p>
          </div>
        )}
      </div>

      {result && (
        <div className="grid gap-6">
          <ResultCard title="Executive Summary" content={result.summary} icon={Sparkles} />
          <ResultCard title="Study Notes" content={result.notes} icon={Quote} />
          <ResultCard title="Important Questions" content={result.questions} icon={Target} />
        </div>
      )}
    </div>
  );
}

function ResultCard({ title, content, icon: Icon }: { title: string, content: string, icon: any }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl animate-reveal">
      <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="p-1.5 rounded-md bg-primary/20 text-primary">
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="font-bold text-sm tracking-wide">{title}</h3>
      </div>
      <div className="p-6 text-sm whitespace-pre-wrap leading-relaxed text-card-foreground/90 font-mono">
        {content}
      </div>
    </div>
  );
}
