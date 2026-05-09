"use client";

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

// Browser-native voice dictation. Uses the Web Speech API
// (SpeechRecognition / webkitSpeechRecognition), which:
//
//   - Costs nothing — no API, no backend, no recurring spend.
//   - Works in Chrome, Edge, and Safari (~95% of HRCC users).
//   - Runs on-device on iOS/macOS Safari (no audio leaves the device);
//     Chrome streams audio to Google's STT — same path Google uses for
//     any text-field dictation, no PHI implications beyond what already
//     happens when staff dictate elsewhere on the device.
//
// Drop the button into any field where typing slows the operator down.
// On click, it listens, streams interim text into the input, and
// commits final text by appending (or replacing if `replace` is true).
//
// The component falls back to a disabled state with a helpful tooltip
// when the browser doesn't support SpeechRecognition (Firefox).

type DictationLang = 'en-US' | 'en-GB' | string;

// Minimal SpeechRecognition typings — TS DOM lib doesn't expose these
// as part of standard Window in all configs.
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};
type SpeechRecognitionErrorEvent = { error: string };
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function DictationButton({
  value,
  onChange,
  lang = 'en-US',
  replace = false,
  size = 'sm',
  className = '',
  title = 'Dictate (click to start)',
}: {
  value: string;
  onChange: (next: string) => void;
  lang?: DictationLang;
  // When true, dictation REPLACES the current value. When false (default)
  // it APPENDS to the existing value with a leading space — natural for
  // building up message bodies sentence by sentence.
  replace?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // Buffer the value at the moment dictation starts so we know what to
  // append to as more results arrive — without this, fast dictation can
  // race against React state updates.
  const baseValueRef = useRef('');

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
  }, []);

  // Tear down the recognition instance on unmount so the browser doesn't
  // keep the mic indicator on if the operator navigates away mid-dictation.
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  function start() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    baseValueRef.current = replace ? '' : value;

    rec.onstart = () => {
      setListening(true);
      setInterim('');
    };
    rec.onresult = (event: SpeechRecognitionEvent) => {
      let finalChunk = '';
      let interimChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const t = r[0].transcript;
        if (r.isFinal) finalChunk += t;
        else interimChunk += t;
      }
      if (finalChunk) {
        const sep = baseValueRef.current && !baseValueRef.current.endsWith(' ') ? ' ' : '';
        baseValueRef.current = `${baseValueRef.current}${sep}${finalChunk}`.trimStart();
        onChange(baseValueRef.current);
        setInterim('');
      } else if (interimChunk) {
        setInterim(interimChunk);
        // Show the live interim text in the field so the operator sees
        // their words as they speak. Final commit replaces this with
        // the cleaned final transcript.
        const sep = baseValueRef.current && !baseValueRef.current.endsWith(' ') ? ' ' : '';
        onChange(`${baseValueRef.current}${sep}${interimChunk}`.trimStart());
      }
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      // 'no-speech' fires when the user stops talking — not a real error.
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        // eslint-disable-next-line no-console
        console.warn('[Dictation] error:', e.error);
      }
      setListening(false);
      setInterim('');
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      // start() throws if called twice in quick succession — ignore.
    }
  }

  function stop() {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }

  if (supported === false) {
    return (
      <button
        type="button"
        disabled
        title="Voice dictation not supported in this browser. Try Chrome, Edge, or Safari."
        className={`inline-flex items-center justify-center rounded p-1.5 text-slate-600 opacity-40 cursor-not-allowed ${className}`}
      >
        <MicOff size={size === 'sm' ? 12 : 14} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => (listening ? stop() : start())}
      title={listening ? `Listening — click to stop${interim ? ` (${interim.slice(0, 40)}…)` : ''}` : title}
      className={`inline-flex items-center justify-center rounded p-1.5 transition ${
        listening
          ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40 animate-pulse'
          : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
      } ${className}`}
      aria-pressed={listening}
      aria-label={listening ? 'Stop dictation' : 'Start dictation'}
    >
      {listening ? (
        <Loader2 size={size === 'sm' ? 12 : 14} className="animate-spin" />
      ) : (
        <Mic size={size === 'sm' ? 12 : 14} />
      )}
    </button>
  );
}
