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
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [withMic, setWithMic] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
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
    setError(null);
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const stream = display;
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
        : "video/webm";
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
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (recorder.state === "recording") recorder.stop();
      });
      recorder.start(1000);
      startedAt.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
      }, 500);
    } catch {
      setError("Screen capture was cancelled or isn't available in this browser.");
    }
  }

  function stop() {
    recorderRef.current?.stop(); // onstop does the cleanup
  }

  return (
    <ToolWidget>
      <div className="space-y-4">
        {!recording && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <Button size="lg" onClick={start}>
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
            <p className="font-display text-[10px] text-ink uppercase">Recording {formatClock(elapsed)}</p>
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
              <li key={index} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-display text-[8px] text-ink-soft uppercase">
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
                      setRecordings((current) => current.filter((_, i) => i !== index));
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
