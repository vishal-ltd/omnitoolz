"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Square } from "lucide-react";
import { ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";
import { downloadBlob, formatBytes } from "@/lib/utils";

interface Recording {
  blob: Blob;
  url: string;
  durationSec: number;
  createdAt: string;
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function ScreenRecorderTool() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [withMic, setWithMic] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAt = useRef(0);
  const startingRef = useRef(false);
  const recordingsRef = useRef<Recording[]>([]);

  useEffect(() => {
    recordingsRef.current = recordings;
  }, [recordings]);

  useEffect(() => {
    return () => {
      // Detach onstop so a late stop can't create object URLs after unmount.
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
      recordingsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  function cleanup() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
  }

  async function start() {
    // The permission prompt is async — a second click must not open a second stream.
    if (startingRef.current || recorderRef.current) return;
    startingRef.current = true;
    setPending(true);
    setError(null);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const display = stream;
      if (withMic) {
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          mic.getAudioTracks().forEach((track) => display.addTrack(track));
        } catch {
          setError("Microphone unavailable — recording screen audio only.");
        }
      }
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : null;
      if (!mimeType) throw new Error("This browser can't record WebM video — try Chrome, Edge or Firefox.");
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const durationSec = Math.round((Date.now() - startedAt.current) / 1000);
        if (blob.size > 0) {
          setRecordings((current) => [
            { blob, url: URL.createObjectURL(blob), durationSec, createdAt: new Date().toLocaleTimeString() },
            ...current,
          ]);
        }
        cleanup();
      };
      // If the user clicks the browser's own "stop sharing", stop gracefully.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorder.state === "recording") recorder.stop();
      });
      recorder.start(1000);
      startedAt.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
      }, 500);
    } catch (error) {
      // Any failure after capture must release the screen/mic — indicators stay on otherwise.
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setError(
        !stream
          ? "Screen capture was cancelled or isn't available in this browser."
          : error instanceof Error && error.name === "Error"
            ? error.message // our own user-facing wording
            : "Recording couldn't start in this browser — try Chrome, Edge or Firefox.",
      );
    } finally {
      startingRef.current = false;
      setPending(false);
    }
  }

  function stop() {
    const recorder = recorderRef.current;
    // A second click before onstop fires would throw InvalidStateError.
    if (recorder && recorder.state !== "inactive") recorder.stop(); // onstop does the cleanup
  }

  return (
    <ToolWidget>
      <div className="space-y-4">
        {!recording && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <Button size="lg" onClick={start} disabled={pending}>
                <Monitor className="size-4" aria-hidden />
                Start screen recording
              </Button>
              <Checkbox checked={withMic} onChange={setWithMic} label="Narrate with your microphone" />
            </div>
            <p className="text-sm text-ink-soft">
              Pick the tab, window or whole screen in the browser&apos;s share dialog. Recording happens
              entirely on your device — nothing is uploaded.
            </p>
          </div>
        )}

        {recording && (
          <div className="flex flex-wrap items-center gap-4 border-[3px] border-err bg-err-soft p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
            <span className="size-3 animate-blink bg-err" aria-hidden />
            <p className="font-display text-display-xs text-ink uppercase">Recording {formatClock(elapsed)}</p>
            <Button onClick={stop}>
              <Square className="size-4" aria-hidden />
              Stop & save
            </Button>
          </div>
        )}

        {error && (
          <div className="border-[3px] border-warn bg-warn-soft p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
            <p className="font-body text-lg text-ink">{error}</p>
          </div>
        )}

        {recordings.length > 0 && (
          <ul className="divide-y-[3px] divide-line overflow-hidden border-[3px] border-edge bg-card shadow-[4px_4px_0_0_var(--color-shadow)]">
            {recordings.map((recordingItem, index) => (
              <li key={recordingItem.url} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-display text-display-xs text-ink-soft uppercase">
                  #{recordings.length - index} · {formatClock(recordingItem.durationSec)} · {formatBytes(recordingItem.blob.size)} · {recordingItem.createdAt}
                </span>
                <video src={recordingItem.url} controls className="w-full border-[3px] border-edge" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => downloadBlob(recordingItem.blob, `screen-recording-${recordings.length - index}.webm`)}>
                    Save .webm
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      URL.revokeObjectURL(recordingItem.url);
                      // Match by identity, not index — a new recording prepends and shifts indices.
                      setRecordings((current) => current.filter((item) => item.url !== recordingItem.url));
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ToolWidget>
  );
}
