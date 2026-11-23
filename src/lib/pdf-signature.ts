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
    // Indefinite lengths are not DER; oversized lengths would read past the
    // buffer or produce NaN comparisons that silently pass bounds checks.
    if (numBytes === 0) throw new Error("DER: indefinite lengths are not supported.");
    if (numBytes > 4) throw new Error("DER: length field too large.");
    if (pos + numBytes > bytes.length) throw new Error("DER: truncated length.");
    len = 0;
    for (let i = 0; i < numBytes; i++) {
      len = len * 256 + bytes[pos];
      pos += 1;
    }
  }
  if (!Number.isSafeInteger(len) || pos + len > bytes.length) {
    throw new Error("DER: content exceeds buffer.");
  }
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

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

/** latin1 view without Buffer, so the module stays bundler-agnostic. */
function latin1(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  }
  return chunks.join("");
}

// ── Signature discovery ────────────────────────────────────────────

export interface SignatureSpan {
  /** The four ByteRange integers — the two covered segments. */
  byteRange: [number, number, number, number];
  /** Hex content gap (start, end) within the file. */
  contentsStart: number;
  contentsEnd: number;
}

/**
 * The dictionary that encloses `index`, found by walking back to its opening
 * `<<` and forward to the matching `>>`. Scoping ByteRange/Contents to a real
 * /Type /Sig dictionary keeps byte sequences inside content streams from
 * fabricating signatures, and pairs the two keys by dictionary, not proximity.
 */
function enclosingDict(latin: string, index: number): { start: number; text: string } | null {
  let depth = 0;
  let start = -1;
  for (let i = index; i >= 1; i--) {
    if (latin[i] === ">" && latin[i - 1] === ">") {
      depth++;
      i--;
    } else if (latin[i] === "<" && latin[i - 1] === "<") {
      if (depth === 0) {
        start = i - 1;
        break;
      }
      depth--;
      i--;
    }
  }
  if (start < 0) return null;
  let d = 0;
  for (let i = start; i < latin.length - 1; i++) {
    if (latin[i] === "<" && latin[i + 1] === "<") {
      d++;
      i++;
    } else if (latin[i] === ">" && latin[i + 1] === ">") {
      d--;
      i++;
      if (d === 0) return { start, text: latin.slice(start, i + 1) };
    }
  }
  return null;
}

export function findSignatureSpans(bytes: Uint8Array): SignatureSpan[] {
  const latin = latin1(bytes);
  const spans: SignatureSpan[] = [];
  const sigRegex = /\/Type\s*\/Sig\b/g;
  let m: RegExpExecArray | null;
  while ((m = sigRegex.exec(latin)) !== null) {
    const dict = enclosingDict(latin, m.index);
    if (!dict) continue;
    const rangeMatch = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(dict.text);
    // Spec-legal hex strings may contain whitespace.
    const contentsMatch = /\/Contents\s*<([0-9A-Fa-f\s]+)>/.exec(dict.text);
    if (!rangeMatch || !contentsMatch) continue;
    spans.push({
      byteRange: [
        Number(rangeMatch[1]),
        Number(rangeMatch[2]),
        Number(rangeMatch[3]),
        Number(rangeMatch[4]),
      ],
      contentsStart: dict.start + contentsMatch.index + contentsMatch[0].indexOf("<") + 1,
      contentsEnd: dict.start + contentsMatch.index + contentsMatch[0].lastIndexOf(">"),
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
  /** DER of the certificate matching this signer (issuer + serial). */
  certificate: Uint8Array | null;
}

/** Issuer DER + serial number of a certificate, for signer matching. */
function certificateIssuerAndSerial(certDer: Uint8Array): { issuer: Uint8Array; serial: Uint8Array } | null {
  try {
    const cert = readDerNode(certDer, 0);
    const tbs = derChildren(certDer, cert)[0];
    const children = derChildren(certDer, tbs);
    let i = 0;
    if (children[0]?.tag === 0xa0) i = 1; // explicit [0] version
    const serial = children[i];
    const issuer = children[i + 2]; // serial, signature alg, issuer
    if (!serial || !issuer || serial.tag !== 0x02 || issuer.tag !== 0x30) return null;
    return {
      issuer: certDer.slice(issuer.headerStart, issuer.next),
      serial: derContentBytes(certDer, serial),
    };
  } catch {
    return null;
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Parse every signerInfo in a CMS SignedData (certificate matched per signer). */
export function parseCmsSigners(cms: Uint8Array): CmsInfo[] {
  const root = readDerNode(cms, 0); // ContentInfo SEQ
  const rootChildren = derChildren(cms, root);
  if (rootChildren.length < 2) throw new Error("CMS: ContentInfo needs two children.");
  // ContentInfo.content is [0] EXPLICIT ANY — real signers (Adobe, OpenSSL,
  // forge) wrap SignedData in it; unwrap before reading its children.
  let signedData = rootChildren[1];
  if (signedData.tag === 0xa0) signedData = derChildren(cms, signedData)[0];
  const sdChildren = derChildren(cms, signedData);

  // children: [version, digestAlgorithms, encapContentInfo, [0] certificates?, [1] crls?, signerInfos]
  let certificates: Uint8Array[] = [];
  let signerInfos: DerNode | null = null;
  for (const child of sdChildren) {
    if (child.tag === 0xa0 && certificates.length === 0) {
      certificates = derChildren(cms, child).map((cert) => cms.slice(cert.headerStart, cert.next));
    }
    if (child.tag === 0x31) signerInfos = child;
  }
  if (!signerInfos) throw new Error("CMS: no signerInfos.");

  const signers: CmsInfo[] = [];
  for (const signerInfo of derChildren(cms, signerInfos)) {
    const siChildren = derChildren(cms, signerInfo);
    let digestAlgorithmOid: string | null = null;
    let signedAttrsSet: Uint8Array | null = null;
    let signature = new Uint8Array(0);
    let signingTime: string | null = null;
    let messageDigestHex: string | null = null;

    // signerInfo: [version, issuerAndSerial, digestAlgorithm, [0] signedAttrs,
    //              signatureAlgorithm, signature, [1] unsignedAttrs?]
    const sid = siChildren[1];
    let certificate: Uint8Array | null = certificates[0] ?? null;
    if (sid && sid.tag === 0x30) {
      const sidParts = derChildren(cms, sid);
      if (sidParts.length >= 2) {
        const issuer = cms.slice(sidParts[0].headerStart, sidParts[0].next);
        const serial = derContentBytes(cms, sidParts[1]);
        // Certificate order in the set is not guaranteed — match by issuer
        // and serial, or we'd verify against the wrong key.
        const matched = certificates.find((cert) => {
          const id = certificateIssuerAndSerial(cert);
          return id !== null && bytesEqual(id.issuer, issuer) && bytesEqual(id.serial, serial);
        });
        if (matched) certificate = matched;
      }
    }

    for (const child of siChildren) {
      if (child.tag === 0x30 && digestAlgorithmOid === null) {
        const alg = derChildren(cms, child);
        if (alg.length > 0 && alg[0].tag === 0x06) {
          digestAlgorithmOid = decodeOid(derContentBytes(cms, alg[0]));
        }
      } else if ((child.tag === 0xa0 || child.tag === 0x80) && !signedAttrsSet) {
        // [0] IMPLICIT SET OF Attribute — rebuild the SET for verification.
        const content = new Uint8Array(derContentBytes(cms, child));
        signedAttrsSet = Uint8Array.of(0x31, ...derLenOf(content.length), ...content);
        for (const attr of derChildren(cms, child)) {
          const parts = derChildren(cms, attr);
          if (parts.length < 2) continue;
          // Attribute ::= SEQUENCE { type OID, values SET OF AttributeValue }.
          // The value lives INSIDE the SET — reading the SET's content directly
          // yields the inner TLV, not the value (the old tamper-check bug).
          const values = derChildren(cms, parts[1]);
          const value = values[0];
          if (!value) continue;
          if (contentMatches(cms, parts[0], oidContent("1.2.840.113549.1.9.4"))) {
            messageDigestHex = toHex(derContentBytes(cms, value));
          } else if (contentMatches(cms, parts[0], oidContent("1.2.840.113549.1.9.5"))) {
            signingTime = new TextDecoder().decode(derContentBytes(cms, value));
          }
        }
      } else if (child.tag === 0x04 && signature.length === 0) {
        signature = new Uint8Array(derContentBytes(cms, child));
      }
    }

    signers.push({ messageDigestHex, signingTime, signedAttrsSet, signature, digestAlgorithmOid, certificate });
  }
  return signers;
}

/** First signer — kept for callers that only display one report. */
export function parseCms(cms: Uint8Array): CmsInfo {
  const signers = parseCmsSigners(cms);
  if (signers.length === 0) throw new Error("CMS: no signerInfos.");
  return signers[0];
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
 * Inspect a PDF's signatures. `digestFn` is injected so the tests can use
 * node:crypto and the browser can use WebCrypto.
 */
export async function inspectSignatures(
  bytes: Uint8Array,
  digestFn: (data: Uint8Array, algorithm: string) => Promise<Uint8Array>,
  verifyFn: (spki: Uint8Array, algorithmOid: string, signature: Uint8Array, data: Uint8Array) => Promise<boolean>,
): Promise<SignatureReport[]> {
  const spans = findSignatureSpans(bytes);
  const reports: SignatureReport[] = [];
  for (const span of spans) {
    let cmsSigners: CmsInfo[];
    try {
      const contentsHex = latin1(bytes.slice(span.contentsStart, span.contentsEnd)).replace(/\s+/g, "");
      cmsSigners = parseCmsSigners(hexToBytes(contentsHex));
    } catch (error) {
      reports.push({
        signer: null,
        signingTime: null,
        integrityOk: null,
        signatureValid: null,
        digestAlgorithmOid: null,
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    for (const cms of cmsSigners) {
      const report: SignatureReport = {
        signer: null,
        signingTime: null,
        integrityOk: null,
        signatureValid: null,
        digestAlgorithmOid: null,
        detail: "",
      };
      try {
        report.signingTime = cms.signingTime;
        report.digestAlgorithmOid = cms.digestAlgorithmOid;
        if (cms.certificate) report.signer = certificateCommonName(cms.certificate);

        // ByteRange must span the whole file minus the Contents gap, or
        // appended content outside the covered ranges goes unchecked.
        const [b1, l1, b2, l2] = span.byteRange;
        if (!(b1 === 0 && b2 + l2 === bytes.length && b1 + l1 <= span.contentsStart && b2 >= span.contentsEnd)) {
          report.detail =
            "ByteRange doesn't span the whole file — content outside the covered ranges isn't checked.";
        }

        const covered = coveredRangesBytes(bytes, span.byteRange);
        const digestAlgorithm = digestAlgorithmName(cms.digestAlgorithmOid);
        if (!digestAlgorithm) {
          report.detail = `Unsupported digest algorithm${cms.digestAlgorithmOid ? ` (${cms.digestAlgorithmOid})` : ""}.`;
        } else {
          const computedHex = toHex(await digestFn(covered, digestAlgorithm));
          report.integrityOk = cms.messageDigestHex === null ? null : computedHex === cms.messageDigestHex;
        }

        if (cms.certificate && cms.signedAttrsSet) {
          const spki = certificateSpki(cms.certificate);
          if (spki) {
            report.signatureValid = await verifyFn(
              spki,
              cms.digestAlgorithmOid ?? "2.16.840.1.101.3.4.2.1",
              cms.signature,
              cms.signedAttrsSet,
            );
          } else {
            report.detail =
              (report.detail ? `${report.detail} ` : "") +
              "Signer key isn't RSA (e.g. ECDSA) — cryptographic verification isn't supported here; the integrity check still applies.";
          }
        } else if (!cms.signedAttrsSet) {
          report.detail = "Direct signature (no authenticated attributes) — integrity check skipped.";
        }
      } catch (error) {
        report.detail = error instanceof Error ? error.message : String(error);
      }
      reports.push(report);
    }
  }
  return reports;
}

function digestAlgorithmName(oid: string | null): string | null {
  switch (oid) {
    case "2.16.840.1.101.3.4.2.1":
      return "SHA-256";
    case "2.16.840.1.101.3.4.2.2":
      return "SHA-384";
    case "2.16.840.1.101.3.4.2.3":
      return "SHA-512";
    default:
      return null;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}