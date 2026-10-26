/**
 * PDF digital-signature inspection — pure, DOM-free.
 *
 * Honest scope: this module detects signature fields, checks whether the
 * covered byte ranges still match the signed digest (tamper detection),
 * and verifies the CMS signature cryptographically with the certificate
 * embedded in the file. It does NOT validate certificate trust chains —
 * a valid signature proves the document matches what the signer signed,
 * not that the signer is who they claim to be.
 */

/** Minimal DER node view over raw bytes. */
export interface DerNode {
  tag: number;
  /** Byte offset of the length header. */
  headerStart: number;
  contentStart: number;
  contentEnd: number;
  next: number;
}

export function readDerNode(bytes: Uint8Array, offset: number): DerNode {
  if (offset + 2 > bytes.length) throw new Error("DER: truncated header.");
  const tag = bytes[offset];
  let pos = offset + 1;
  let len = bytes[pos];
  pos += 1;
  if (len & 0x80) {
    const numBytes = len & 0x7f;
    len = 0;
    for (let i = 0; i < numBytes; i++) {
      len = len * 256 + bytes[pos];
      pos += 1;
    }
  }
  if (pos + len > bytes.length) throw new Error("DER: content exceeds buffer.");
  return {
    tag,
    headerStart: offset,
    contentStart: pos,
    contentEnd: pos + len,
    next: pos + len,
  };
}

function derContentBytes(bytes: Uint8Array, node: DerNode): Uint8Array {
  return bytes.slice(node.contentStart, node.contentEnd);
}

function derChildren(bytes: Uint8Array, node: DerNode): DerNode[] {
  const children: DerNode[] = [];
  let cursor = node.contentStart;
  while (cursor < node.contentEnd) {
    const child = readDerNode(bytes, cursor);
    children.push(child);
    cursor = child.next;
  }
  return children;
}

/** OID dotted string → DER-encoded OID TLV (for comparisons). */
function oidBytes(dotted: string): Uint8Array {
  const parts = dotted.split(".").map(Number);
  const body = [parts[0] * 40 + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    const stack = [v & 0x7f];
    v >>= 7;
    while (v > 0) { stack.unshift((v & 0x7f) | 0x80); v >>= 7; }
    body.push(...stack);
  }
  return Uint8Array.of(0x06, body.length, ...body);
}

/** OID body bytes (no tag/length) for content comparisons. */
function oidContent(dotted: string): Uint8Array {
  return oidBytes(dotted).slice(2);
}

function contentMatches(bytes: Uint8Array, node: DerNode, expected: Uint8Array): boolean {
  const content = derContentBytes(bytes, node);
  if (content.length !== expected.length) return false;
  for (let i = 0; i < content.length; i++) if (content[i] !== expected[i]) return false;
  return true;
}

// ── Signature discovery ────────────────────────────────────────────

export interface SignatureSpan {
  /** The four ByteRange integers — the two covered segments. */
  byteRange: [number, number, number, number];
  /** Hex content gap (start, end) within the file. */
  contentsStart: number;
  contentsEnd: number;
}

export function findSignatureSpans(bytes: Uint8Array): SignatureSpan[] {
  const latin = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");
  const spans: SignatureSpan[] = [];
  const rangeRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  const contentsRegex = /\/Contents\s*<([0-9A-Fa-f]+)>/g;
  const ranges: Array<{ match: RegExpExecArray; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = rangeRegex.exec(latin)) !== null) {
    ranges.push({ match: m, index: m.index });
  }
  const contents: Array<{ match: RegExpExecArray; index: number }> = [];
  while ((m = contentsRegex.exec(latin)) !== null) {
    contents.push({ match: m, index: m.index });
  }
  for (const range of ranges) {
    // Pair with the nearest /Contents that follows it.
    const paired = contents.find((c) => c.index > range.index);
    if (!paired) continue;
    spans.push({
      byteRange: [
        Number(range.match[1]),
        Number(range.match[2]),
        Number(range.match[3]),
        Number(range.match[4]),
      ],
      contentsStart: paired.index + paired.match[0].indexOf("<") + 1,
      contentsEnd: paired.index + paired.match[0].indexOf(">"),
    });
  }
  return spans;
}

/** Hash of the covered byte ranges — the value the signature signs.
 *  ByteRange semantics: [B1, L1, B2, L2] → covered = [B1, B1+L1) ∪ [B2, B2+L2). */
export function coveredRangesBytes(bytes: Uint8Array, range: SignatureSpan["byteRange"]): Uint8Array {
  const first = bytes.slice(range[0], range[0] + range[1]);
  const second = bytes.slice(range[2], range[2] + range[3]);
  const out = new Uint8Array(first.length + second.length);
  out.set(first, 0);
  out.set(second, first.length);
  return out;
}

// ── CMS (PKCS#7) parsing ───────────────────────────────────────────

export interface CmsInfo {
  /** Message digest from the authenticated attributes (hex). */
  messageDigestHex: string | null;
  /** Signing time from authenticated attributes (UTCTime string). */
  signingTime: string | null;
  /** Raw DER of the authenticated attributes SET (for crypto verify). */
  signedAttrsSet: Uint8Array | null;
  /** Signature bytes. */
  signature: Uint8Array;
  /** Digest algorithm OID, e.g. 2.16.840.1.101.3.4.2.1 (SHA-256). */
  digestAlgorithmOid: string | null;
  /** DER of the first certificate. */
  certificate: Uint8Array | null;
}

export function parseCms(cms: Uint8Array): CmsInfo {
  const root = readDerNode(cms, 0); // ContentInfo SEQ
  const rootChildren = derChildren(cms, root);
  if (rootChildren.length < 2) throw new Error("CMS: ContentInfo needs two children.");
  const signedData = readDerNode(cms, rootChildren[1].headerStart); // SEQ
  const sdChildren = derChildren(cms, signedData);

  // children: [version, digestAlgorithms, encapContentInfo, [0] certificates?, [1] crls?, signerInfos]
  let certificate: Uint8Array | null = null;
  let signerInfos: DerNode | null = null;
  for (const child of sdChildren) {
    if (child.tag === 0xa0 && !certificate) certificate = derContentBytes(cms, child);
    if (child.tag === 0x31) signerInfos = child;
  }
  if (!signerInfos) throw new Error("CMS: no signerInfos.");
  const signerInfo = readDerNode(cms, signerInfos.contentStart);
  const siChildren = derChildren(cms, signerInfo);
  if (process.env.SIG_DEBUG) {
  console.error("SIG_DEBUG si tags:", siChildren.map((c) => `0x${c.tag.toString(16)}@${c.contentStart}+${c.contentEnd - c.contentStart}`).join(" "));
  for (const child of siChildren) {
    if (child.tag === 0xa0 || child.tag === 0x80) {
      const attrs = derChildren(cms, child);
      console.error("SIG_DEBUG attrs node len:", child.contentEnd - child.contentStart, "| children:", attrs.length, "| first kid tag:", attrs[0] ? "0x" + attrs[0].tag.toString(16) : "none");
    }
  }
}

  let digestAlgorithmOid: string | null = null;
  let signedAttrsSet: Uint8Array | null = null;
  let signature = new Uint8Array(0);
  let signingTime: string | null = null;
  let messageDigestHex: string | null = null;

  for (const child of siChildren) {
    if (child.tag === 0x30 && digestAlgorithmOid === null) {
      const alg = derChildren(cms, child);
      if (alg.length > 0 && alg[0].tag === 0x06) {
        const oidContent = derContentBytes(cms, alg[0]);
        digestAlgorithmOid = decodeOid(oidContent);
      }
    } else if ((child.tag === 0xa0 || child.tag === 0x80) && !signedAttrsSet) {
      // [0] IMPLICIT SET OF Attribute — rebuild the SET for verification.
      const content = new Uint8Array(derContentBytes(cms, child));
      signedAttrsSet = Uint8Array.of(0x31, ...derLenOf(content.length), ...content);
      // Extract attributes
      const attrs = derChildren(cms, child);
      for (const attr of attrs) {
        const parts = derChildren(cms, attr);
        if (parts.length < 2) continue;
        const type = derContentBytes(cms, parts[0]);
        if (contentMatches(cms, parts[0], oidContent("1.2.840.113549.1.9.4"))) {
          messageDigestHex = [...derContentBytes(cms, parts[1])]
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        } else if (contentMatches(cms, parts[0], oidContent("1.2.840.113549.1.9.5"))) {
          signingTime = new TextDecoder().decode(derContentBytes(cms, parts[1]));
        }
        void type;
      }
    } else if (child.tag === 0x04 && signature.length === 0) {
      signature = new Uint8Array(derContentBytes(cms, child));
    }
  }

  return { messageDigestHex, signingTime, signedAttrsSet, signature, digestAlgorithmOid, certificate };
}

function derLenOf(len: number): Uint8Array {
  if (len < 0x80) return Uint8Array.of(len);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function decodeOid(content: Uint8Array): string {
  const parts: number[] = [];
  const first = content[0];
  parts.push(Math.floor(first / 40), first % 40);
  let value = 0;
  for (let i = 1; i < content.length; i++) {
    value = (value << 7) | (content[i] & 0x7f);
    if ((content[i] & 0x80) === 0) {
      parts.push(value);
      value = 0;
    }
  }
  return parts.join(".");
}

// ── Certificate inspection (best-effort display) ───────────────────

/** Extract the Subject CN (or first UTF8 RDN value) from a certificate DER. */
export function certificateCommonName(certDer: Uint8Array): string | null {
  try {
    const cert = readDerNode(certDer, 0);
    const tbs = derChildren(certDer, cert)[0];
    const tbsChildren = derChildren(certDer, tbs);
    // Find the subject: the SEQ after validity, or scan for the CN OID.
    for (const child of tbsChildren) {
      if (child.tag !== 0x30) continue;
      const rdns = derChildren(certDer, child);
      if (rdns.length === 0 || rdns[0].tag !== 0x31) continue;
      for (const rdn of rdns) {
        const atvs = derChildren(certDer, rdn);
        for (const atv of atvs) {
          const parts = derChildren(certDer, atv);
          if (parts.length === 2 && contentMatches(certDer, parts[0], oidContent("2.5.4.3"))) {
            return new TextDecoder().decode(derContentBytes(certDer, parts[1]));
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Extract SubjectPublicKeyInfo DER (for WebCrypto verify). */
export function certificateSpki(certDer: Uint8Array): Uint8Array | null {
  try {
    const cert = readDerNode(certDer, 0);
    const tbs = derChildren(certDer, cert)[0];
    for (const child of derChildren(certDer, tbs)) {
      if (child.tag !== 0x30) continue;
      const grand = derChildren(certDer, child);
      if (grand.length >= 1 && grand[0].tag === 0x30) {
        const algChildren = derChildren(certDer, grand[0]);
        if (algChildren.length > 0 && contentMatches(certDer, algChildren[0], oidContent("1.2.840.113549.1.1.1"))) {
          // Reconstruct the full SPKI TLV (tag + length + content).
          return Uint8Array.of(
            child.tag,
            ...derLenOf(child.contentEnd - child.contentStart),
            ...derContentBytes(certDer, child),
          );
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── Top-level inspection ───────────────────────────────────────────

export interface SignatureReport {
  signer: string | null;
  signingTime: string | null;
  /** true = covered bytes match the signed digest. */
  integrityOk: boolean | null;
  /** true = CMS signature verifies with the embedded certificate. */
  signatureValid: boolean | null;
  digestAlgorithmOid: string | null;
  /** Human-readable failure detail when a check is false/null. */
  detail: string;
}

/**
 * Inspect a PDF's signatures. `digestFn` computes SHA-256 (injected so the
 * tests can use node:crypto and the browser uses WebCrypto).
 */
export async function inspectSignatures(
  bytes: Uint8Array,
  digestFn: (data: Uint8Array, algorithm: string) => Promise<Uint8Array>,
  verifyFn: (spki: Uint8Array, algorithmOid: string, signature: Uint8Array, data: Uint8Array) => Promise<boolean>,
): Promise<SignatureReport[]> {
  const spans = findSignatureSpans(bytes);
  const reports: SignatureReport[] = [];
  for (const span of spans) {
    const report: SignatureReport = {
      signer: null,
      signingTime: null,
      integrityOk: null,
      signatureValid: null,
      digestAlgorithmOid: null,
      detail: "",
    };
    try {
      const contentsHex = new TextDecoder("latin1").decode(
        bytes.slice(span.contentsStart, span.contentsEnd),
      ).replace(/\s+/g, "");
      const cmsBytes = hexToBytes(contentsHex);
      const cms = parseCms(cmsBytes);
      report.signingTime = cms.signingTime;
      report.digestAlgorithmOid = cms.digestAlgorithmOid;
      if (cms.certificate) report.signer = certificateCommonName(cms.certificate);

      const covered = coveredRangesBytes(bytes, span.byteRange);
      const computedHex = [...await digestFn(covered, "SHA-256")].map((b) => b.toString(16).padStart(2, "0")).join("");
      report.integrityOk = cms.messageDigestHex === null ? null : computedHex === cms.messageDigestHex;

      if (cms.certificate && cms.signedAttrsSet) {
        const spki = certificateSpki(cms.certificate);
        if (spki) {
          report.signatureValid = await verifyFn(
            spki,
            cms.digestAlgorithmOid ?? "2.16.840.1.101.3.4.2.1",
            cms.signature,
            cms.signedAttrsSet,
          );
        }
      } else if (!cms.signedAttrsSet) {
        report.detail = "Direct signature (no authenticated attributes) — integrity check skipped.";
      }
    } catch (error) {
      report.detail = error instanceof Error ? error.message : String(error);
    }
    reports.push(report);
  }
  return reports;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
