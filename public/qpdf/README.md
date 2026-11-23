# Vendored engine: qpdf (PDF compression / linearization)

- **Upstream package:** [`@jspawn/qpdf-wasm@0.0.2`](https://www.npmjs.com/package/@jspawn/qpdf-wasm/v/0.0.2)
  (files `qpdf.js` + `qpdf.wasm`, copied verbatim).
- **License:** Apache-2.0 — see [`LICENSE`](./LICENSE) in this directory, copied
  verbatim from the upstream package.
- **SHA-256:**
  - `qpdf.js`: `0129E94930F34F9B3B371DB00427F9AE81502BC8BE4873F9AD114FC353AE306F`
  - `qpdf.wasm`: `CBD81A244D622A39E3CF16F2E589A9A0D7CC51F588D35B3DD6B425A677CC3F99`

## Updating

1. Bump `@jspawn/qpdf-wasm` in `package.json` and `npm install`.
2. Copy `node_modules/@jspawn/qpdf-wasm/qpdf.js` and `qpdf.wasm` into this
   directory, and its `LICENSE` over `LICENSE`.
3. Update the version and SHA-256 values above.
4. Run `npm test && npm run build` and verify the Compress PDF tool in a browser.

The copies are byte-identical to the pinned npm package; keep them in sync when
the dependency changes.