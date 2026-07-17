import { useState, useRef, useEffect, useCallback } from 'react';
import { useProcessClass, getGetHistoryQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Mic, Square, Loader2, Sparkles, Target, Quote } from 'lucide-react';

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

  // Set up SpeechRecognition once on mount
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript((prev) => prev + ' ' + finalTranscript);
        }
      };
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
      };
      recognitionRef.current = recognition;
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // --- Waveform drawing loop ---
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount; // fftSize / 2 = 1024
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
        // dataArray values are 0–255; 128 = silence (centre)
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };

    draw();
  }, []);

  // Keep canvas dimensions in sync with its CSS size
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

  // --- Draw a flat idle line when not recording ---
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

  // --- Stop all audio resources ---
  const stopAudio = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    drawFlatLine();
  }, [drawFlatLine]);

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
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
      // Start recording
      setTranscript('');
      setResult(null);

      try {
        // 1. Capture mic stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // 2. Build audio analysis pipeline
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        source.connect(analyser);
        // Note: do NOT connect analyser to destination — we don't want mic playback

        // 3. Start the waveform loop
        drawWaveform();

        // 4. Start speech recognition
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {
            // already started
          }
        }

        setIsRecording(true);
      } catch (err) {
        console.error('Microphone access denied:', err);
        alert('Microphone access was denied. Please allow microphone permissions and try again.');
      }
    }
  };

  // Cleanup everything on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [stopAudio]);

  return (
    <div className="flex flex-col gap-8 animate-reveal">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">Live Class Capture</h2>
        <p className="text-muted-foreground">
          Record your lecture to generate a summary, notes, and key questions.
        </p>
      </div>

      <div className="relative rounded-3xl border border-border bg-card p-8 flex flex-col items-center justify-center overflow-hidden shadow-2xl gap-6">
        {isRecording && (
          <div className="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none" />
        )}

        <button
          onClick={toggleRecording}
          disabled={processClass.isPending}
          className={cn(
            'w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 shadow-lg',
            isRecording
              ? 'bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30'
              : 'bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30',
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
            ? 'Recording... Tap to stop & process'
            : 'Tap to begin recording'}
        </p>

        {/* Waveform canvas — always mounted so ResizeObserver can size it */}
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

function ResultCard({
  title,
  content,
  icon: Icon,
}: {
  title: string;
  content: string;
  icon: any;
}) {
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
