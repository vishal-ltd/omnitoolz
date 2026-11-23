# Vendored engine: libheif (HEIC/HEIF decoding)

- **Upstream package:** [`libheif-js@1.23.5`](https://www.npmjs.com/package/libheif-js/v/1.23.5)
  (file `libheif/libheif.js`, the self-contained Emscripten build with the WASM
  embedded — no separate `.wasm` file).
- **Underlying codec:** [strukturag/libheif](https://github.com/strukturag/libheif)
  with libde265 for HEIC decoding.
- **License:** LGPL-3.0 — see [`LICENSE`](./LICENSE) in this directory, copied
  verbatim from the upstream package. The corresponding source is the upstream
  package and repository linked above (exact version pinned here).
- **SHA-256 of `libheif.js`:**
  `2256FFEE78039843AC47581B731BF837E4A29F08FFA91B7409CAEBD89A6968EA`

## Updating

1. `npm pack libheif-js@<new version>` and extract it.
2. Copy `package/libheif/libheif.js` over this directory's `libheif.js` and
   `package/libheif/LICENSE` over `LICENSE`.
3. Update the version and SHA-256 above
   (`Get-FileHash libheif.js -Algorithm SHA256`).
4. Run `npm test && npm run build` and verify the HEIC to JPG tool in a browser.

The file is loaded with a script tag by `src/features/images/heic-to-jpg.tsx`
(no bundler), so it must stay a self-contained UMD build.