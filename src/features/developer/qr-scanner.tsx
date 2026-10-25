"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageIcon } from "lucide-react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";

interface ScanResult {
  text: string;
  source: string;
  at: string;
}

export default function QrScannerTool() {
  const queue = useFileQueue({ accept: ["png", "jpg", "jpeg", "webp", "gif", "bmp"], multiple: false, maxFiles: 1, maxSizeMb: 20 });
  const [results, setResults] = useState<ScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const decode = useCallback(async (source: CanvasImageSource, width: number, height: number): Promise<string | null> => {
    const { default: jsQR } = await import("jsqr");
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height);
    return jsQR(data.data, width, height)?.data ?? null;
  }, []);

  // Image file path
  useEffect(() => {
    const file = queue.files[0];
    if (!file) return;
    let cancelled = false;
    setError(null);
    setScanning(true);
    (async () => {
      try {
        const bitmap = await createImageBitmap(file);
        const text = await decode(bitmap, bitmap.width, bitmap.height);
        bitmap.close();
        if (cancelled) return;
        if (text) {
          setResults((current) => [{ text, source: file.name, at: new Date().toLocaleTimeString() }, ...current]);
        } else {
          setError("No QR code found in that image — try a clearer or larger crop.");
        }
      } catch {
        if (!cancelled) setError("That image couldn't be decoded.");
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queue.files, decode]);

  // Camera loop
  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCameraOn(true);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const tick = async () => {
        if (!streamRef.current || video.readyState < 2) return;
        try {
          const text = await decode(video, video.videoWidth, video.videoHeight);
          if (text) {
            setResults((current) => [{ text, source: "camera", at: new Date().toLocaleTimeString() }, ...current]);
            stopCamera();
            return;
          }
        } catch {
          // keep scanning
        }
        window.setTimeout(tick, 250);
      };
      tick();
    } catch {
      setError("Camera access was blocked — allow it in the browser or scan an image instead.");
    }
  }

  return (
    <ToolWidget>
      <div className="space-y-4">
        {!cameraOn && (
          <>
            <div className="flex flex-wrap gap-3">
              <Button onClick={startCamera}>
                <Camera className="size-4" aria-hidden />
                Scan with camera
              </Button>
            </div>
            <FileDropZone
              accept={["png", "jpg", "jpeg", "webp", "gif", "bmp"]}
              multiple={false}
              maxFiles={1}
              maxSizeMb={20}
              onFiles={queue.addFiles}
              existingCount={queue.files.length}
            />
            <FileList files={queue.files} onRemove={queue.removeAt} />
          </>
        )}

        {cameraOn && (
          <div className="space-y-3">
            <video ref={videoRef} className="w-full border-[3px] border-edge bg-black shadow-[4px_4px_0_0_var(--color-shadow)]" playsInline muted />
            <p className="font-body text-lg text-ink-soft">Hold a QR code in view — it scans automatically.</p>
            <Button variant="secondary" onClick={stopCamera}>
              Stop camera
            </Button>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" aria-hidden />

        {scanning && <p className="font-body text-lg text-ink-soft">Decoding…</p>}
        {error && <p className="border-[3px] border-err bg-err-soft p-3 font-body text-lg text-ink">{error}</p>}

        {results.length > 0 && (
          <ul className="divide-y-[3px] divide-line overflow-hidden border-[3px] border-edge bg-card shadow-[4px_4px_0_0_var(--color-shadow)]">
            {results.map((result, index) => (
              <li key={`${result.at}-${index}`} className="px-4 py-3">
                <p className="flex items-center gap-2 font-display text-[8px] text-ink-soft uppercase">
                  <ImageIcon className="size-3" aria-hidden />
                  {result.source} · {result.at}
                </p>
                <p className="mt-1.5 break-all font-body text-lg text-ink">{result.text}</p>
                {/^https?:\/\//i.test(result.text) && (
                  <a href={result.text} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-body text-lg text-brand underline">
                    Open link →
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}

        {results.length > 1 && (
          <Button variant="secondary" onClick={() => setResults([])}>
            Clear results
          </Button>
        )}
      </div>
    </ToolWidget>
  );
}
