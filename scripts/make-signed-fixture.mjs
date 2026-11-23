/**
 * Regenerate src/lib/fixtures/signed-fixture.pdf with a REAL CMS signature
 * (node-forge, dev-only): proper SET-wrapped signed attributes, a certificate
 * whose issuer/serial match the signerInfo, and a ByteRange that spans the
 * whole file minus the Contents gap. The old hand-built fixture omitted the
 * SET wrapper and certified a parser bug instead of catching it.
 *
 *   node scripts/make-signed-fixture.mjs
 *
 * The signing time is fixed (2026-10-25T12:00:00Z) so tests can assert it
 * exactly: UTCTime "261025120000Z".
 */
import forge from "node-forge";
import fs from "node:fs";
import path from "node:path";

const { privateKey, publicKey } = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();
cert.publicKey = publicKey;
cert.serialNumber = "01";
cert.validity.notBefore = new Date("2026-01-01T00:00:00Z");
cert.validity.notAfter = new Date("2036-01-01T00:00:00Z");
const attrs = [{ name: "commonName", value: "Test Signer" }];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(privateKey, forge.md.sha256.create());

const HEX_LENGTH = 16384; // 8192 bytes of placeholder — plenty for RSA-2048 CMS
const template = `%PDF-1.7
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 44 >> stream
BT /F1 12 Tf 72 720 Td (Signed fixture) Tj ET
endstream endobj
5 0 obj << /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /ByteRange [0000000000 0000000000 0000000000 0000000000] /Contents <${"0".repeat(HEX_LENGTH)}> >> endobj
trailer << /Root 1 0 R /Size 6 >>
`;

let pdf = Buffer.from(template, "latin1");
// Anchor on the hex gap specifically — "/Contents 4 0 R" (the page's content
// stream reference) must not be mistaken for the signature's /Contents <hex>.
const contentsAnchor = /\/Contents\s*</.exec(pdf.toString("latin1"));
if (!contentsAnchor) throw new Error("template lost its /Contents hex gap");
const contentsOpen = contentsAnchor.index + contentsAnchor[0].length - 1;
const contentsClose = pdf.indexOf(">", contentsOpen);
const gapStart = contentsOpen; // gap includes the angle brackets
const gapEnd = contentsClose + 1;
const range = [0, gapStart, gapEnd, pdf.length - gapEnd];
const rangeText = range.map((n) => String(n).padStart(10, "0")).join(" ");
pdf = Buffer.from(
  pdf.toString("latin1").replace(/\/ByteRange \[[^\]]*\]/, `/ByteRange [${rangeText}]`),
  "latin1",
);

const covered = Buffer.concat([pdf.subarray(0, gapStart), pdf.subarray(gapEnd)]);
const p7 = forge.pkcs7.createSignedData();
p7.content = forge.util.createBuffer(covered.toString("binary"));
p7.addCertificate(cert);
p7.addSigner({
  key: privateKey,
  certificate: cert,
  digestAlgorithm: forge.pki.oids.sha256,
  authenticatedAttributes: [
    { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
    { type: forge.pki.oids.messageDigest }, // forge computes the digest value
    { type: forge.pki.oids.signingTime, value: new Date("2026-10-25T12:00:00Z") },
  ],
});
p7.sign();
const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
if (der.length > HEX_LENGTH / 2) throw new Error("CMS bigger than the placeholder — raise HEX_LENGTH.");
const hex = Buffer.from(der, "binary").toString("hex").padEnd(HEX_LENGTH, "0");
pdf = Buffer.from(
  pdf.toString("latin1").slice(0, contentsOpen + 1) + hex + pdf.toString("latin1").slice(contentsClose),
  "latin1",
);

const out = path.resolve(import.meta.dirname, "../src/lib/fixtures/signed-fixture.pdf");
fs.writeFileSync(out, pdf);
console.log(`Wrote ${out} (${pdf.length} bytes, CMS ${der.length} bytes)`);