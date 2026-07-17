import { useState, useRef, useEffect, useCallback } from 'react';
import { useProcessClass, getGetHistoryQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Mic, Square, Loader2, Sparkles, Target, Quote, FlaskConical } from 'lucide-react';

export function ClassMode() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<any>(null);

  const recognitionRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const queryClient = useQueryClient();
  const processClass = useProcessClass();

  // Set up SpeechRecognition on mount
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      // Indian English / Hinglish locale for best mixed-language capture
      recognition.lang = navigator.language || 'en-IN';
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) setTranscript((prev) => prev + ' ' + finalTranscript);
      };
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
      };
      recognitionRef.current = recognition;
    }
    return () => { if (recognitionRef.current) recognitionRef.current.stop(); };
  }, []);

  // Keep canvas dimensions synced with CSS size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    observer.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => observer.disconnect();
  }, []);

  const drawFlatLine = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#10B981';
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, []);

  useEffect(() => {
    if (!isRecording) drawFlatLine();
  }, [isRecording, drawFlatLine]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#10B981';
      ctx.beginPath();
      const sliceWidth = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };
    draw();
  }, []);

  const stopAudio = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    drawFlatLine();
  }, [drawFlatLine]);

  const toggleRecording = async () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      stopAudio();
      setIsRecording(false);
      if (transcript.trim()) {
        processClass.mutate(
          { data: { transcript } },
          {
            onSuccess: (data) => {
              setResult(data.content);
              queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
            },
          }
        );
      }
    } else {
      setTranscript('');
      setResult(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;
        source.connect(analyser);
        drawWaveform();
        if (recognitionRef.current) {
          try { recognitionRef.current.start(); } catch { /* already started */ }
        }
        setIsRecording(true);
      } catch (err) {
        console.error('Microphone access denied:', err);
        alert('Microphone access was denied. Please allow microphone permissions and try again.');
      }
    }
  };

  useEffect(() => {
    return () => { stopAudio(); if (recognitionRef.current) recognitionRef.current.stop(); };
  }, [stopAudio]);

  return (
    <div className="flex flex-col gap-8 animate-reveal">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">Live Class Capture</h2>
        <p className="text-muted-foreground">Record your lecture to generate a summary, notes, formulas, and key questions.</p>
      </div>

      <div className="relative rounded-3xl border border-border bg-card p-8 flex flex-col items-center justify-center overflow-hidden shadow-2xl gap-6">
        {/* Pulsing live banner */}
        {isRecording && (
          <div className="absolute top-0 inset-x-0 bg-[#EF4444]/10 border-b border-[#EF4444]/30 py-2 px-4 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
            <span className="text-xs font-bold tracking-widest uppercase text-[#EF4444]">🎙️ Live Listening...</span>
          </div>
        )}

        <button
          onClick={toggleRecording}
          disabled={processClass.isPending}
          className={cn(
            'w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 shadow-lg mt-4',
            isRecording
              ? 'bg-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/30 border border-[#EF4444]/40'
              : 'bg-[#10B981]/20 text-[#10B981] hover:bg-[#10B981]/30 border border-[#10B981]/30',
            processClass.isPending && 'opacity-50 cursor-not-allowed'
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

        <p className="text-sm font-medium tracking-wide relative z-10">
          {processClass.isPending
            ? 'Synthesizing materials...'
            : isRecording
            ? 'Tap to stop & process'
            : 'Tap to begin recording'}
        </p>

        {/* Waveform canvas */}
        <div className="w-full relative z-10">
          <canvas
            ref={canvasRef}
            className="w-full rounded-lg bg-[#0B0F19]"
            style={{ height: '96px', display: 'block' }}
          />
        </div>

        {transcript && (
          <div className="w-full pt-4 border-t border-border/50 relative z-10">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              Live Transcript
            </h3>
            <p className="text-sm font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap">{transcript}</p>
          </div>
        )}
      </div>

      {result && (
        <div className="grid gap-6">
          <ResultCard title="Executive Summary" content={result.summary} icon={Sparkles} accentColor="#10B981" />
          <ResultCard title="Study Notes" content={result.notes} icon={Quote} accentColor="#10B981" />
          <ResultCard title="Formulas & Key Definitions" content={result.formulas} icon={FlaskConical} accentColor="#10B981" />
          <ResultCard title="Exam Questions & Answers" content={result.questions} icon={Target} accentColor="#10B981" />
        </div>
      )}
    </div>
  );
}

function ResultCard({ title, content, icon: Icon, accentColor }: { title: string; content: string; icon: any; accentColor: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl animate-reveal">
      <div className="bg-muted/30 px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="p-1.5 rounded-md" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="font-bold text-sm tracking-wide">{title}</h3>
      </div>
      <div className="p-6 text-sm whitespace-pre-wrap leading-relaxed text-card-foreground/90 font-mono">{content}</div>
    </div>
  );
}
