"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/form";
import { downloadBlob } from "@/lib/utils";

type Ecc = "L" | "M" | "Q" | "H";

export default function QrGeneratorTool() {
  const [text, setText] = useState("");
  const [size, setSize] = useState(512);
  const [ecc, setEcc] = useState<Ecc>("M");
  const [margin, setMargin] = useState(2);
  const [dark, setDark] = useState("#111827");
  const [light, setLight] = useState("#ffffff");
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      setError(null);
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (text.trim().length === 0) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = size;
          canvas.height = size;
          ctx.fillStyle = light;
          ctx.fillRect(0, 0, size, size);
        }
        return;
      }
      try {
        const QRCode = await import("qrcode");
        await QRCode.toCanvas(canvas, text, {
          width: size,
          margin,
          errorCorrectionLevel: ecc,
          color: { dark, light },
        });
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error && /too long|big/i.test(err.message)
              ? "The content is too long for a QR code — shorten it or lower the error-correction level."
              : "The QR code couldn't be generated. Check the content and colors.",
          );
        }
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [text, size, margin, ecc, dark, light]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `qr-code-${size}px.png`);
    }, "image/png");
  }

  return (
    <ToolWidget>
      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <Field label="Content" hint="A URL, plain text, phone number, Wi-Fi string…">
            <TextInput
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="https://example.com"
              aria-label="QR code content"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Size">
              <Select value={size} onChange={(event) => setSize(Number(event.target.value))} aria-label="QR code size">
                <option value={256}>256 × 256 px</option>
                <option value={512}>512 × 512 px</option>
                <option value={1024}>1024 × 1024 px</option>
              </Select>
            </Field>
            <Field label="Error correction" hint="Higher survives more damage">
              <Select value={ecc} onChange={(event) => setEcc(event.target.value as Ecc)} aria-label="Error correction level">
                <option value="L">L — 7%</option>
                <option value="M">M — 15% (default)</option>
                <option value="Q">Q — 25%</option>
                <option value="H">H — 30%</option>
              </Select>
            </Field>
            <Field label="Foreground">
              <input
                type="color"
                value={dark}
                onChange={(event) => setDark(event.target.value)}
                className="h-11 w-full cursor-pointer border-[3px] border-edge bg-card p-1 shadow-[3px_3px_0_0_var(--color-shadow)]"
                aria-label="Foreground color"
              />
            </Field>
            <Field label="Background">
              <input
                type="color"
                value={light}
                onChange={(event) => setLight(event.target.value)}
                className="h-11 w-full cursor-pointer border-[3px] border-edge bg-card p-1 shadow-[3px_3px_0_0_var(--color-shadow)]"
                aria-label="Background color"
              />
            </Field>
            <Field label={`Quiet zone — ${margin} modules`} hint="White border around the code" className="sm:col-span-2">
              <input
                type="range"
                min={0}
                max={8}
                value={margin}
                onChange={(event) => setMargin(Number(event.target.value))}
                className="h-10 flex-1 cursor-pointer"
                aria-label="Quiet zone margin"
              />
            </Field>
          </div>

          {error && (
            <p className="rounded-xl border border-err/30 bg-err-soft px-4 py-2.5 text-sm text-err" role="alert">
              {error}
            </p>
          )}

          <Button onClick={download} disabled={text.trim().length === 0 || Boolean(error)}>
            <Download className="size-4" aria-hidden />
            Download PNG
          </Button>
        </div>

        <div className="flex items-start justify-center">
          <canvas
            ref={canvasRef}
            className="w-full max-w-64 border-[3px] border-edge bg-white shadow-[5px_5px_0_0_var(--color-shadow)]"
            aria-label="QR code preview"
          />
        </div>
      </div>
    </ToolWidget>
  );
}
