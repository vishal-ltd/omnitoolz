"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { ToolWidget } from "@/components/tools/job-ui";
import { Button } from "@/components/ui/button";
import {
  findSignatureSpans,
  inspectSignatures,
  type SignatureReport,
} from "@/lib/pdf-signature";
import { formatBytes } from "@/lib/utils";

/** OID → WebCrypto digest name (null = not verifiable in this tool). */
function digestName(oid: string | null): string | null {
  if (oid === "2.16.840.1.101.3.4.2.1") return "SHA-256";
  if (oid === "2.16.840.1.101.3.4.2.2") return "SHA-384";
  if (oid === "2.16.840.1.101.3.4.2.3") return "SHA-512";
  return null;
}

async function digestFn(data: Uint8Array, algorithm: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest(algorithm, data as unknown as BufferSource));
}

async function verifyFn(
  spki: Uint8Array,
  algorithmOid: string,
  signature: Uint8Array,
  data: Uint8Array,
): Promise<boolean> {
  const hash = digestName(algorithmOid);
  if (!hash) return false;
  const key = await crypto.subtle.importKey(
    "spki",
    spki as unknown as BufferSource,
    { name: "RSASSA-PKCS1-v1_5", hash },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5", hash },
    key,
    signature as unknown as BufferSource,
    data as unknown as BufferSource,
  );
}

function VerdictCard({ report, fileName }: { report: SignatureReport; fileName: string }) {
  const integrity = report.integrityOk;
  const crypto = report.signatureValid;
  return (
    <div
      className={`space-y-3 border-[3px] p-4 shadow-[4px_4px_0_0_var(--color-shadow)] ${
        integrity === false ? "border-err bg-err-soft" : "border-edge bg-card"
      }`}
    >
      <p className="font-display text-[10px] text-ink uppercase">
        {report.signer ?? "Unknown signer"} · {fileName}
      </p>

      <div className="space-y-2 font-body text-lg leading-snug text-ink">
        {integrity === true && (
          <p className="text-ok">✓ Document integrity — the covered bytes match the signed digest. The file has NOT been modified since it was signed.</p>
        )}
        {integrity === false && (
          <p className="text-err">✗ MODIFIED after signing — the covered bytes don&apos;t match the signed digest. Distrust this document.</p>
        )}
        {integrity === null && <p>▸ Integrity couldn&apos;t be checked ({report.detail || "unsupported structure"}).</p>}

        {crypto === true && <p className="text-ok">✓ Signature verified cryptographically with the certificate embedded in the file.</p>}
        {crypto === false && <p className="text-err">✗ Signature does NOT verify with the embedded certificate.</p>}
        {crypto === null && <p>▸ Signature bytes present but not cryptographically verified here.</p>}

        {report.signingTime && <p className="text-ink-soft">Claimed signing time: {report.signingTime}</p>}
        {report.digestAlgorithmOid && (
          <p className="text-ink-soft">Digest: {digestName(report.digestAlgorithmOid) ?? report.digestAlgorithmOid}</p>
        )}
      </div>
    </div>
  );
}

export default function VerifyPdfSignatureTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const [reports, setReports] = useState<SignatureReport[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const file = queue.files[0];

  async function inspect() {
    if (!file) return;
    setError(null);
    setScanning(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const spans = findSignatureSpans(bytes);
      if (spans.length === 0) {
        setReports([]);
        return;
      }
      const result = await inspectSignatures(bytes, digestFn, verifyFn);
      setReports(result);
    } catch {
      setError("The signature structures couldn't be parsed — the file may use an unsupported format.");
    } finally {
      setScanning(false);
    }
  }

  function startOver() {
    queue.clear();
    setReports(null);
    setError(null);
    setScanning(false);
  }

  return (
    <ToolWidget>
      <div className="space-y-4">
        {!reports && !scanning && (
          <>
            <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
            <FileList files={queue.files} onRemove={queue.removeAt} />
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-ink-soft">
                Everything is checked locally — the file, its signatures and its certificates never leave this tab.
              </p>
              <Button size="lg" disabled={!file} onClick={inspect}>
                Inspect Signatures
              </Button>
            </div>
          </>
        )}

        {scanning && (
          <p className="font-body text-lg text-ink-soft">Verifying signatures…</p>
        )}
        {error && (
          <div className="border-[3px] border-err bg-err-soft p-3 font-body text-lg text-ink">{error}</div>
        )}

        {reports && reports.length === 0 && (
          <div className="border-[3px] border-edge bg-card p-4 shadow-[4px_4px_0_0_var(--color-shadow)]">
            <p className="font-display text-[10px] text-ink uppercase">No digital signatures</p>
            <p className="mt-2 font-body text-lg text-ink-soft">
              “{file?.name}” ({formatBytes(file?.size ?? 0)}) carries no signature fields — nothing
              to verify. That&apos;s normal for most everyday PDFs.
            </p>
          </div>
        )}

        {reports && reports.length > 0 && (
          <div className="space-y-3">
            {reports.map((report, index) => (
              <VerdictCard key={index} report={report} fileName={file?.name ?? "document.pdf"} />
            ))}
            <div className="border-[3px] border-edge bg-canvas p-3">
              <p className="text-sm text-ink-soft">
                Honest scope: a valid signature proves the document matches what the signer signed —
                it does <strong>not</strong> prove the signer&apos;s identity against certificate
                authorities. For legally binding validation, use Adobe Acrobat or a qualified
                trust-chain validator.
              </p>
            </div>
            <Button variant="secondary" onClick={startOver}>
              Inspect another file
            </Button>
          </div>
        )}
      </div>
    </ToolWidget>
  );
}
