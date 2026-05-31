"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RecState = "idle" | "recording" | "saved";

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function ScreenRecorder() {
  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [filename, setFilename] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedHandlerRef = useRef<(() => void) | null>(null);

  const supported =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getDisplayMedia === "function";

  useEffect(() => {
    if (state !== "recording") return;
    const t0 = performance.now();
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((performance.now() - t0) / 1000));
    }, 250);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2500);
  }, []);

  const cleanupStream = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    if (endedHandlerRef.current) {
      const track = stream.getVideoTracks()[0];
      if (track) track.removeEventListener("ended", endedHandlerRef.current);
      endedHandlerRef.current = null;
    }
    stream.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const save = useCallback(() => {
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    chunksRef.current = [];
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const name = `treemap_demo_${date}.webm`;
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setFilename(name);
    setDownloadUrl(url);
    setState("saved");
    setTimeout(() => {
      URL.revokeObjectURL(url);
      setDownloadUrl((cur) => (cur === url ? null : cur));
    }, 8000);
    setTimeout(() => setState("idle"), 3000);
  }, []);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
    cleanupStream();
  }, [cleanupStream]);

  const start = useCallback(async () => {
    if (state !== "idle" || !supported) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" } as MediaTrackConstraints,
        audio: false,
      });
      streamRef.current = stream;

      const candidates = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const mime =
        candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => save();
      rec.start(1000);
      recorderRef.current = rec;

      const track = stream.getVideoTracks()[0];
      if (track) {
        const handler = () => stop();
        endedHandlerRef.current = handler;
        track.addEventListener("ended", handler);
      }
      setState("recording");
    } catch {
      cleanupStream();
      showToast("Recording cancelled");
      setState("idle");
    }
  }, [state, supported, save, stop, cleanupStream, showToast]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cleanupStream();
    };
  }, [cleanupStream]);

  const onClick = () => {
    if (!supported) return;
    if (state === "idle") void start();
    else if (state === "recording") stop();
  };

  const baseClasses =
    "fixed bottom-4 left-4 z-40 inline-flex items-center justify-center gap-1.5 h-8 px-3 min-w-[80px] rounded-full text-xs font-medium border transition-all select-none";

  let pill: React.ReactNode;
  if (!supported) {
    pill = (
      <button
        type="button"
        disabled
        title="Screen recording not supported in this browser"
        className={`${baseClasses} bg-neutral-800/60 border-neutral-700 text-neutral-500 cursor-not-allowed`}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-neutral-500" />
        <span>REC</span>
      </button>
    );
  } else if (state === "recording") {
    pill = (
      <button
        type="button"
        onClick={onClick}
        title="Click to stop recording"
        className={`${baseClasses} bg-red-600 border-white/80 text-white animate-pulse font-mono`}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-white" />
        <span>{formatTime(elapsed)}</span>
      </button>
    );
  } else if (state === "saved") {
    pill = (
      <button
        type="button"
        onClick={(e) => e.preventDefault()}
        title={filename}
        className={`${baseClasses} bg-emerald-700 border-white/80 text-white cursor-default`}
      >
        <span>{"✓ Saved"}</span>
      </button>
    );
  } else {
    pill = (
      <button
        type="button"
        onClick={onClick}
        title="Start screen recording"
        className={`${baseClasses} bg-neutral-900 border-white/80 text-white hover:bg-neutral-800`}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
        <span>REC</span>
      </button>
    );
  }

  return (
    <>
      {pill}
      {state === "saved" && filename && (
        <div className="fixed bottom-16 left-4 z-40 max-w-xs rounded-md border border-white/10 bg-neutral-900/95 px-3 py-2 text-xs text-white shadow-lg animate-in fade-in">
          {"✓ Saved "}
          {downloadUrl ? (
            <a
              href={downloadUrl}
              download={filename}
              className="underline decoration-dotted hover:text-emerald-300"
            >
              {filename}
            </a>
          ) : (
            <span className="font-mono">{filename}</span>
          )}
          {" — click to download"}
        </div>
      )}
      {toast && (
        <div className="fixed bottom-16 left-4 z-40 rounded-md border border-white/10 bg-neutral-900/95 px-3 py-2 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
