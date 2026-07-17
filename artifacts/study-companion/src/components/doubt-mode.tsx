import { useState, useRef, useEffect, useCallback } from 'react';
import { useProcessDoubt, getGetHistoryQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Loader2, Lightbulb, Send } from 'lucide-react';

export function DoubtMode() {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState<any>(null);

  const recognitionRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const queryClient = useQueryClient();
  const processDoubt = useProcessDoubt();

  // Set up SpeechRecognition on mount
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-IN';
      recognition.onresult = (event: any) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
        }
        if (final) setQuery((prev) => (prev ? prev + ' ' + final : final).trim());
      };
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        stopAudio();
        setIsListening(false);
      };
      recognition.onend = () => {
        stopAudio();
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    }
    return () => { if (recognitionRef.current) recognitionRef.current.stop(); };
  }, []);

  // Canvas resize sync
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
    if (!isListening) drawFlatLine();
  }, [isListening, drawFlatLine]);

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

  const toggleVoice = async () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      stopAudio();
      setIsListening(false);
      return;
    }
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
      setIsListening(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access was denied. Please allow microphone permissions and try again.');
    }
  };

  const handleSubmit = () => {
    if (!query.trim() || processDoubt.isPending) return;
    setResult(null);
    processDoubt.mutate(
      { data: { query: query.trim() } },
      {
        onSuccess: (data) => {
          setResult(data.content);
          queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
        },
      }
    );
  };

  useEffect(() => {
    return () => { stopAudio(); if (recognitionRef.current) recognitionRef.current.stop(); };
  }, [stopAudio]);

  return (
    <div className="flex flex-col gap-8 animate-reveal">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">Ask a Doubt</h2>
        <p className="text-muted-foreground">Type or speak your question in any language — get a clear English answer.</p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-8 flex flex-col gap-6 shadow-2xl">
        {/* Input area */}
        <div className="flex flex-col gap-3">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
            Type or Speak Your Doubt
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. What is recursion? / Recursion ka matlab kya hai? / React hooks kaise kaam karte hain?"
            rows={4}
            className="w-full rounded-xl bg-background border border-border px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/40 transition-all"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
          />
        </div>

        {/* Voice capture + waveform */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleVoice}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border transition-all duration-300',
                isListening
                  ? 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/40 hover:bg-[#F59E0B]/30'
                  : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:bg-muted/60'
              )}
            >
              {isListening ? (
                <><MicOff className="w-4 h-4" /><span>Stop Listening</span></>
              ) : (
                <><Mic className="w-4 h-4" /><span>Speak Doubt</span></>
              )}
            </button>
            {isListening && (
              <span className="text-xs font-bold tracking-widest uppercase text-[#F59E0B] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse" />
                Listening...
              </span>
            )}
          </div>

          {/* Waveform canvas */}
          <canvas
            ref={canvasRef}
            className="w-full rounded-lg bg-[#0B0F19]"
            style={{ height: '80px', display: 'block' }}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!query.trim() || processDoubt.isPending}
          className={cn(
            'flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm transition-all duration-300',
            'bg-[#F59E0B] text-black hover:bg-[#F59E0B]/90',
            (!query.trim() || processDoubt.isPending) && 'opacity-40 cursor-not-allowed'
          )}
        >
          {processDoubt.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Thinking...</>
          ) : (
            <><Send className="w-4 h-4" />Get Answer</>
          )}
        </button>
      </div>

      {result && (
        <div className="rounded-2xl border border-[#F59E0B]/30 bg-card overflow-hidden shadow-xl animate-reveal">
          <div className="bg-[#F59E0B]/10 px-6 py-4 border-b border-[#F59E0B]/20 flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-[#F59E0B]/20 text-[#F59E0B]">
              <Lightbulb className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm tracking-wide">Answer</h3>
          </div>
          <div className="p-6 text-sm whitespace-pre-wrap leading-relaxed text-card-foreground/90 font-mono">
            {result.answer}
          </div>
        </div>
      )}
    </div>
  );
}
