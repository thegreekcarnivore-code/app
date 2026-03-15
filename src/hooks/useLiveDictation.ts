import { useState, useRef, useCallback, useEffect } from "react";

interface UseLiveDictationOptions {
  lang: string;
  onFinalTranscript: (text: string) => void;
  onInterimUpdate?: (text: string) => void;
}

interface UseLiveDictationReturn {
  start: () => void;
  stop: () => void;
  cancel: () => void;
  isListening: boolean;
  interimText: string;
  isSupported: boolean;
}

// Extend Window for SpeechRecognition
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionResultItem;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

const getSpeechRecognition = (): (new () => SpeechRecognitionInstance) | null => {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

const useLiveDictation = ({
  lang,
  onFinalTranscript,
  onInterimUpdate,
}: UseLiveDictationOptions): UseLiveDictationReturn => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const cancelledRef = useRef(false);
  const finalBufferRef = useRef("");

  const isSupported = !!getSpeechRecognition();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  const start = useCallback(() => {
    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) return;

    // Abort any existing session
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang === "el" ? "el-GR" : "en-US";

    cancelledRef.current = false;
    finalBufferRef.current = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (cancelledRef.current) return;

      let finalTranscript = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }

      // Emit finalized text immediately
      if (finalTranscript) {
        finalBufferRef.current += finalTranscript;
        onFinalTranscript(finalTranscript);
      }

      // Update interim display
      setInterimText(interim);
      onInterimUpdate?.(interim);
    };

    recognition.onerror = (event: any) => {
      // "no-speech" and "aborted" are non-fatal
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.warn("SpeechRecognition error:", event.error);
      setIsListening(false);
      setInterimText("");
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening (browser sometimes stops)
      if (isListening && !cancelledRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start();
          return;
        } catch {}
      }
      setIsListening(false);
      setInterimText("");
      onInterimUpdate?.("");
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
      setInterimText("");
    } catch (e) {
      console.error("Failed to start SpeechRecognition:", e);
    }
  }, [lang, onFinalTranscript, onInterimUpdate, isListening]);

  const stop = useCallback(() => {
    setIsListening(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setInterimText("");
    onInterimUpdate?.("");
  }, [onInterimUpdate]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setIsListening(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    setInterimText("");
    onInterimUpdate?.("");
  }, [onInterimUpdate]);

  return { start, stop, cancel, isListening, interimText, isSupported };
};

export default useLiveDictation;
