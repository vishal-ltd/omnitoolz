import { createHash, createVerify } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  coveredRangesBytes,
  findSignatureSpans,
  inspectSignatures,
} from "./pdf-signature";

let fixtureBytes: Uint8Array;

beforeAll(() => {
  // Generate the fixture via the dev script (deterministic structure, fresh key).
  execSync("node scripts/make-signed-fixture.mjs", { cwd: process.cwd() });
  const raw = readFileSync(".signed-fixture.pdf");
  fixtureBytes = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
});

const nodeDigest = async (data: Uint8Array) =>
  new Uint8Array(createHash("sha256").update(data).digest());

describe("findSignatureSpans", () => {
  it("finds the ByteRange + Contents pair in the fixture", () => {
    const spans = findSignatureSpans(fixtureBytes);
    expect(spans).toHaveLength(1);
    expect(spans[0].byteRange[0]).toBe(0);
    expect(spans[0].byteRange[2]).toBeGreaterThan(0);
    expect(spans[0].byteRange[3]).toBeGreaterThan(0);
    // Gap must not cover the whole file
    expect(spans[0].byteRange[2] + spans[0].byteRange[3]).toBe(fixtureBytes.length);
  });

  it("finds nothing in an unsigned PDF", () => {
    const plain = new TextEncoder().encode("%PDF-1.7\nno signatures here\n");
    expect(findSignatureSpans(plain)).toHaveLength(0);
  });
});

describe("inspectSignatures", () => {
  it("verifies integrity and the signature cryptographically on the fixture", async () => {
    const reports = await inspectSignatures(
      fixtureBytes,
      nodeDigest,
      async (spki, algorithmOid, signature, data) => {
        // Map OIDs to node algorithm names
        const nodeAlg =
          algorithmOid === "1.2.840.113549.1.1.1" || algorithmOid === "2.16.840.1.101.3.4.2.1"
            ? "sha256"
            : "sha256";
        const verifier = createVerify(nodeAlg === "sha256" ? "RSA-SHA256" : "RSA-SHA256");
        verifier.update(data);
        return verifier.verify(
          {
            key: spki as unknown as string,
            format: "der" as const,
            type: "spki" as const,
          },
          signature,
        );
      },
    );
    expect(reports).toHaveLength(1);
    const report = reports[0];
    console.log("TEST REPORT:", JSON.stringify(report));
    expect(report.integrityOk).toBe(true);
    expect(report.signatureValid).toBe(true);
    expect(report.signer).toBe("Test Signer");
    expect(report.signingTime).toContain("261025120000Z");
  });

  it("detects tampering — a flipped byte breaks the integrity check", async () => {
    const tampered = fixtureBytes.slice();
    // Flip a byte inside the first covered range (before the Contents gap)
    findSignatureSpans(tampered)[0]; // locate the first span (tampered byte chosen accordingly)
    tampered[100] ^= 0xff; // inside the first covered range, well before the gap
    const reports = await inspectSignatures(tampered, nodeDigest, async () => false);
    expect(reports[0].integrityOk).toBe(false);
  });
});

describe("coveredRangesBytes", () => {
  it("joins the two segments in order", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // ByteRange [B1=0, L1=3, B2=7, L2=3] → [0..3) ∪ [7..10)
    const covered = coveredRangesBytes(bytes, [0, 3, 7, 3]);
    expect([...covered]).toEqual([0, 1, 2, 7, 8, 9]);
  });
});
