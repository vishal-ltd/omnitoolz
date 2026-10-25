"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import { Field, RangeInput } from "@/components/ui/form";
import { baseName, bytesToBlob, downloadBlob, formatBytes } from "@/lib/utils";
import { computePeaks, encodeWav, type Peak } from "@/lib/wav";

function clock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
}

export default function AudioTrimmerTool() {
  const queue = useFileQueue({ accept: ["wav", "mp3", "ogg", "webm", "m4a", "aac", "flac"], multiple: false, maxFiles: 1, maxSizeMb: 200 });
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [peaks, setPeaks] = useState<Peak[]>([]);
  const [startPct, setStartPct] = useState(0);
  const [endPct, setEndPct] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoAudioRef = useRef<AudioBufferSourceNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const file = queue.files[0];

  const analyze = useCallback(async (source: File | Blob) => {
    setError(null);
    try {
      const context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const buffer = await context.decodeAudioData(await source.arrayBuffer());
      await context.close();
      setAudioBuffer(buffer);
      setPeaks(computePeaks(buffer.getChannelData(0), 400));
      setStartPct(0);
      setEndPct(100);
    } catch {
      setError("That file couldn't be decoded as audio — try WAV, MP3, OGG, M4A or a .webm recording.");
    }
  }, []);

  useEffect(() => {
    if (file) analyze(file);
  }, [file, analyze]);

  // Waveform painting
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;
    const width = canvas.width;
    const height = canvas.height;
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    const startPx = Math.floor((startPct / 100) * width);
    const endPx = Math.ceil((endPct / 100) * width);
    // Selection background
    context.fillStyle = "#e5e2fa";
    context.fillRect(startPx, 0, endPx - startPx, height);
    // Out-of-selection dimming
    context.fillStyle = "rgba(35,36,47,0.12)";
    context.fillRect(0, 0, startPx, height);
    context.fillRect(endPx, 0, width - endPx, height);

    context.fillStyle = "#5b54e8";
    const mid = height / 2;
    const barWidth = width / peaks.length;
    for (let i = 0; i < peaks.length; i++) {
      const peak = peaks[i];
      const barHeight = Math.max(1, (peak.max - peak.min) * mid * 0.95);
      context.fillRect(i * barWidth, mid - (peak.max * mid * 0.95), Math.max(1, barWidth - 0.5), barHeight);
    }
    // Selection edges
    context.fillStyle = "#23242f";
    context.fillRect(startPx, 0, 2, height);
    context.fillRect(endPx - 2, 0, 2, height);
  }, [peaks, startPct, endPct]);

  function stopPlayback() {
    videoAudioRef.current?.stop();
    videoAudioRef.current = null;
    setPlaying(false);
  }

  function playSelection() {
    if (!audioBuffer) return;
    stopPlayback();
    const context = new AudioContext();
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    source.start(0, (startPct / 100) * audioBuffer.duration, ((endPct - startPct) / 100) * audioBuffer.duration);
    videoAudioRef.current = source;
    setPlaying(true);
    source.onended = () => {
      setPlaying(false);
      context.close();
    };
  }

  function clickWaveform(event: React.MouseEvent<HTMLCanvasElement>, edge: "start" | "end") {
    const rect = event.currentTarget.getBoundingClientRect();
    const pct = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    if (edge === "start") setStartPct(Math.min(pct, endPct - 1));
    else setEndPct(Math.max(pct, startPct + 1));
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        queue.clear();
        const recorded = new File([blob], `recording-${Date.now()}.webm`, { type: "audio/webm" });
        queue.addFiles([recorded]);
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
        if (timerRef.current) window.clearInterval(timerRef.current);
      };
      recorder.start(500);
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      setError("Microphone access isn't available — upload an audio file instead.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  async function exportWav() {
    if (!audioBuffer) return;
    setExporting(true);
    try {
      const startFrame = Math.floor((startPct / 100) * audioBuffer.length);
      const endFrame = Math.ceil((endPct / 100) * audioBuffer.length);
      const frames = Math.max(1, endFrame - startFrame);
      const channels: Float32Array[] = [];
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const source = audioBuffer.getChannelData(channel);
        channels.push(source.slice(startFrame, startFrame + frames));
      }
      const wav = encodeWav(channels, audioBuffer.sampleRate);
      downloadBlob(
        bytesToBlob(wav, "audio/wav"),
        `${baseName(file?.name ?? "audio")}-trimmed.wav`,
      );
    } finally {
      setExporting(false);
    }
  }

  const duration = audioBuffer?.duration ?? 0;
  const selectedSec = (duration * (endPct - startPct)) / 100;

  return (
    <ToolWidget>
      <div className="space-y-4">
        {!recording && !file && (
          <div className="flex flex-wrap gap-3">
            <Button onClick={startRecording}>
              <Mic className="size-4" aria-hidden />
              Record with microphone
            </Button>
          </div>
        )}
        {recording && (
          <div className="flex flex-wrap items-center gap-4 border-[3px] border-err bg-err-soft p-4">
            <span className="size-3 animate-blink bg-err" aria-hidden />
            <p className="font-display text-[10px] text-ink uppercase">Recording {clock(elapsed)}</p>
            <Button onClick={stopRecording}>
              <Square className="size-4" aria-hidden />
              Stop
            </Button>
          </div>
        )}

        <FileDropZone
          accept={["wav", "mp3", "ogg", "webm", "m4a", "aac", "flac"]}
          multiple={false}
          maxFiles={1}
          maxSizeMb={200}
          onFiles={queue.addFiles}
          existingCount={queue.files.length}
          hint="wav · mp3 · ogg · webm · m4a · flac — also trims the audio of a .webm screen recording"
        />
        <FileList files={queue.files} onRemove={queue.removeAt} />

        {error && (
          <div className="border-[3px] border-err bg-err-soft p-3 font-body text-lg text-ink">{error}</div>
        )}

        {audioBuffer && peaks.length > 0 && (
          <>
            <div className="border-[3px] border-edge bg-card p-3 shadow-[4px_4px_0_0_var(--color-shadow)]">
              <p className="font-display text-[8px] text-ink-soft uppercase">
                Waveform — {formatBytes(file?.size ?? 0)} · {clock(duration)} total
              </p>
              <canvas
                ref={canvasRef}
                width={1000}
                height={160}
                className="mt-2 w-full cursor-crosshair border-[3px] border-edge bg-white"
                onClick={(event) => clickWaveform(event, event.shiftKey ? "end" : "start")}
                aria-label="Waveform — click to set the start marker, shift-click for the end marker"
              />
              <p className="mt-2 font-body text-lg text-ink-soft">
                Click = move start marker · Shift-click = move end marker. Selected:{" "}
                <strong className="text-ink">{clock(selectedSec)}</strong>
              </p>
            </div>

            <OptionsPanel title="Trim">
              <Field label={`Start — ${clock((duration * startPct) / 100)}`}>
                <RangeInput value={startPct} min={0} max={99} onChange={(value) => setStartPct(Math.min(value, endPct - 1))} suffix="%" />
              </Field>
              <Field label={`End — ${clock((duration * endPct) / 100)}`}>
                <RangeInput value={endPct} min={1} max={100} onChange={(value) => setEndPct(Math.max(value, startPct + 1))} suffix="%" />
              </Field>
            </OptionsPanel>

            <div className="flex flex-wrap gap-3">
              <Button onClick={playSelection} disabled={playing}>
                {playing ? "Playing…" : "Play selection"}
              </Button>
              <Button variant="secondary" onClick={exportWav} loading={exporting}>
                Export trimmed WAV
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setStartPct(0);
                  setEndPct(100);
                }}
              >
                Select all
              </Button>
            </div>

            <p className="text-sm text-ink-soft">
              Decoded, trimmed and re-encoded to 16-bit PCM WAV locally — your audio never leaves
              this tab.
            </p>
          </>
        )}
      </div>
    </ToolWidget>
  );
}
