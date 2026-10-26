/**
 * Dev fixture builder: constructs a cryptographically signed PDF (Adobe-style
 * CMS with authenticated attributes) using node:crypto + the PEM cert made by
 * openssl (.test-cert.pem / .test-key.pem in the project root).
 *
 * Run:        node scripts/make-signed-fixture.mjs
 * Import:     buildSignedFixture() → { bytes, digestHex, certDer, signedAttrs }
 */
import { createHash, createSign } from "node:crypto";
import forge from "node-forge";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ── DER helpers ─────────────────────────────────────────────────────
function derLen(len) {
  if (len < 0x80) return Uint8Array.of(len);
  const bytes = [];
  let n = len;
  while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}
function tlv(tag, content) {
  return Uint8Array.of(tag, ...derLen(content.length), ...content);
}
function oid(dotted) {
  const parts = dotted.split(".").map(Number);
  const body = [parts[0] * 40 + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    const stack = [v & 0x7f];
    v >>= 7;
    while (v > 0) { stack.unshift((v & 0x7f) | 0x80); v >>= 7; }
    body.push(...stack);
  }
  return tlv(0x06, Uint8Array.from(body));
}
function join(arrays) {
  const out = new Uint8Array(arrays.reduce((s, a) => s + a.length, 0));
  let o = 0;
  for (const a of arrays) { out.set(a, o); o += a.length; }
  return out;
}
function seq(...items) { return tlv(0x30, join(items)); }
function setOf(...items) { return tlv(0x31, join(items)); }
function intVal(n) { return tlv(0x02, Uint8Array.of(n)); }
function octet(bytes) { return tlv(0x04, bytes); }
function ctxImplicit0(content) { return Uint8Array.of(0xa0, ...derLen(content.length), ...content); }
function utf8(text) { return tlv(0x0c, new TextEncoder().encode(text)); }
function utcTime(text) { return tlv(0x17, new TextEncoder().encode(text)); }
function name(cn, org) {
  return seq(setOf(seq(oid("2.5.4.3"), utf8(cn))), setOf(seq(oid("2.5.4.10"), utf8(org))));
}

// ── Fixture construction ───────────────────────────────────────────
export function buildFixture() {
  // Self-signed certificate made in-process — reproducible on any machine
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 3600 * 1000);
  cert.setSubject([{ name: "commonName", value: "Test Signer" }, { name: "organizationName", value: "OmniToolz" }]);
  cert.setIssuer([{ name: "commonName", value: "Test Signer" }, { name: "organizationName", value: "OmniToolz" }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const certDer = Uint8Array.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes().split("").map((c) => c.charCodeAt(0) & 0xff));
  const issuer = name("Test Signer", "OmniToolz");
  
  // PDF body with a placeholder ByteRange and a fixed-size Contents hex gap
  const CONTENTS_HEX_LEN = 8192;
  const parts = [];
  const offsets = [];
  let position = 0;
  const push = (str) => { parts.push(str); position += Buffer.byteLength(str, "latin1"); };

  push("%PDF-1.7\n");
  offsets[1] = position;
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  offsets[2] = position;
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  offsets[3] = position;
  push("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Annots [5 0 R] >>\nendobj\n");
  const stream = "BT /F1 18 Tf 60 760 Td (Signed fixture for the OmniToolz inspector.) Tj ET";
  offsets[4] = position;
  push(`4 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`);
  offsets[5] = position;
  push("5 0 obj\n<< /Type /Annot /Subtype /Widget /FT /Sig /Rect [40 700 300 740] /V 6 0 R >>\nendobj\n");
  offsets[6] = position;
  push("6 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange [0 GAP_A GAP_B GAP_C] /Contents <");
  const gapStart = position;
  push("0".repeat(CONTENTS_HEX_LEN));
  const gapEnd = position;
  push("> /M (D:20261025120000Z) /Reason (Fixture) >>\nendobj\n");
  push("trailer\n<< /Size 7 /Root 1 0 R /AcroForm << /Fields [5 0 R] >> >>\nstartxref\n9999999999\n%%EOF\n");

  // Patch gapA/gapB now (zero-padded, no shift); gapC after the xref splice.
  let latin = parts.join("");
  latin = latin
    .replace("GAP_A", String(gapStart).padStart(5, "0"))
    .replace("GAP_B", String(gapEnd).padStart(5, "0"))
    .replace("GAP_C", "00000");
  let pdfBytes = Uint8Array.from(Buffer.from(latin, "latin1"));
  // Rebuild the xref table: splice it in right before the trailer so the
  // signed body sections (including the "> /M ... endobj" part) stay intact.
  const latin2 = new TextDecoder("latin1").decode(pdfBytes);
  const trailerIdx = latin2.indexOf("trailer\n");
  const xref = ["xref", "0 7", "0000000000 65535 f "];
  for (let i = 1; i <= 6; i++) xref.push(String(offsets[i]).padStart(10, "0") + " 00000 n ");
  const xrefBlock = xref.join("\n") + "\n";
  let withXref = latin2.slice(0, trailerIdx) + xrefBlock + latin2.slice(trailerIdx).replace("9999999999", String(trailerIdx));
  // Now the final length is known: patch gapC in place (zero-padded, no shift).
  const gapC = withXref.length - gapEnd;
  withXref = withXref.replace("00000]", String(gapC).padStart(5, "0") + "]");
  pdfBytes = Uint8Array.from(Buffer.from(withXref, "latin1"));

  // CMS: SHA-256 digest over the covered ranges, signed attributes, RSA signature
  const gapA = gapStart;
  const covered = join([pdfBytes.slice(0, gapA), pdfBytes.slice(gapEnd)]);
  const contentDigest = new Uint8Array(createHash("sha256").update(covered).digest());

  const attrsContent = join([
    seq(oid("1.2.840.113549.1.9.3"), oid("1.2.840.113549.1.7.1")), // contentType = data
    seq(oid("1.2.840.113549.1.9.4"), octet(contentDigest)),        // messageDigest
    seq(oid("1.2.840.113549.1.9.5"), utcTime("261025120000Z")),    // signingTime
  ]);
  const signedAttrs = tlv(0x31, attrsContent); // SET OF — signed over this exact DER
  const signature = createSign("sha256").update(signedAttrs).sign({ key: forge.pki.privateKeyToPem(keys.privateKey), format: "pem" });

  const signerInfo = seq(
    intVal(1),
    seq(issuer, intVal(1)),
    seq(oid("2.16.840.1.101.3.4.2.1")), // digestAlgorithm = sha256
    seq(oid("1.2.840.113549.1.1.1")),   // signatureAlgorithm = rsaEncryption
    ctxImplicit0(attrsContent),         // [0] IMPLICIT SET OF signedAttrs
    octet(signature),
  );
  const signedData = seq(
    intVal(1),
    setOf(seq(oid("2.16.840.1.101.3.4.2.1"))),
    seq(oid("1.2.840.113549.1.7.1")),
    ctxImplicit0(certDer), // [0] IMPLICIT SET OF certificates
    setOf(signerInfo),
  );
  const cms = seq(oid("1.2.840.113549.1.7.2"), signedData);

  // Splice the CMS hex into the gap (must fit — it does with a 2048-bit key)
  const cmsHex = [...cms].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  if (cmsHex.length > CONTENTS_HEX_LEN) {
    throw new Error(`CMS (${cmsHex.length}) exceeds the Contents gap (${CONTENTS_HEX_LEN}).`);
  }
  latin = new TextDecoder("latin1").decode(pdfBytes);
  const final = latin.slice(0, gapStart) + cmsHex + "0".repeat(CONTENTS_HEX_LEN - cmsHex.length) + latin.slice(gapEnd);

  return {
    bytes: Uint8Array.from(Buffer.from(final, "latin1")),
    digestHex: Buffer.from(contentDigest).toString("hex"),
    certDer,
    signedAttrs,
  };
}

export function buildSignedFixture() {
  return buildFixture();
}

const isMain = process.argv[1]?.endsWith("make-signed-fixture.mjs");
if (isMain) {
  const fixture = buildFixture();
  writeFileSync(
    fileURLToPath(new URL("../.signed-fixture.pdf", import.meta.url)),
    Buffer.from(fixture.bytes),
  );
  console.log("fixture written:", fixture.bytes.length, "bytes | digest:", fixture.digestHex.slice(0, 16) + "…");
}
