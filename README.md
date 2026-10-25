# OmniToolz

**Every Tool. One Place.** — a collection of free tools for PDFs, images,
text, developer, security and media tasks. Every tool runs entirely in the
browser: files are processed on the user's device, with no upload, no server
processing, no accounts and no tracking.

**▸ Try it live: [omnitoolz.vercel.app](https://omnitoolz.vercel.app)**

Built with Next.js 15, React 19, TypeScript and Tailwind CSS v4, in a
16-bit pixel-art UI. 59 tools · 114 unit tests · 76 statically generated
pages · first-load JS ~104 kB.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build (76 static pages)
npm run start      # serve the production build
npm test           # vitest unit tests (114)
npm run lint       # eslint (0 errors; see the note on react-hooks below)
```

## Deploying

The app is a standard Next.js deployment — **it works on Vercel with zero
configuration**: push to GitHub, import the repo, deploy. Canonical URLs,
Open Graph tags and the sitemap pick up the deployment URL automatically
(`VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`). Once you point a custom
domain at the deployment, set `NEXT_PUBLIC_SITE_URL` (see `.env.example`) to
override. There are no other environment variables, no database, no secrets.

## What's inside

| Category | Tools |
|---|---|
| PDF (30) | Merge, Split, Rotate, Extract/Reorder/Delete/Organize Pages, PDF ⇄ JPG, JPG to PDF, Add Page Numbers, Protect (AES-256), Unlock, Watermark, Header & Footer, Extract Text, Document Info, Clean (metadata/comments), Flatten Forms, Repair, Crop, Remove Blank Pages, Compare, Extract Images, Read (viewer + hand-off), Invoice Generator, Sign, Camera Scan, Compress (qpdf), Word to PDF, Excel to PDF, PDF to Word |
| Images (10) | Compress, Resize, Crop, JPG ⇄ PNG, WebP Converter, Watermark, Background Remover (on-device AI), HEIC to JPG, Favicon Generator |
| Text (4) | Word Counter, Case Converter, Diff Checker, Image to Text (OCR) |
| Developer (10) | JSON Formatter, QR Generator, JWT Decoder, Base64, UUID, Hash, Timestamp, Color Toolkit, Regex Tester, QR Scanner |
| Security (4) | Password Generator, TOTP Generator, Password Auditor, File Hash Verifier |
| Media (2) | Screen Recorder, Audio Trimmer |

Every tool page carries a privacy note, how-to steps and FAQs — all derived
from the central registry.

## Architecture

```text
src/
├── app/                     Next.js App Router
│   ├── page.tsx             Homepage (hero, featured, categories, ticker)
│   ├── [category]/          Category listing (SSG from the registry)
│   │   └── [tool]/          Tool page → ToolShell + lazy tool widget
│   ├── about|privacy|terms/ Content pages
│   └── sitemap.ts robots.ts SEO (+ JSON-LD)
├── components/
│   ├── layout/              Header, search dialog, theme/accent pickers, footer
│   ├── tools/               Shared tool UX: drop zone, file list, queue,
│   │                        job state machine, results/zip, tool shell
│   └── ui/                  Button + form primitives
├── features/                One component per tool + engine cores
│   ├── tool-loaders.ts      id → lazy component (code-split per tool)
│   ├── pdf/                 pdf-lib / pdf.js / qpdf / conversion cores
│   ├── images/              canvas core + AI/HEIC tools
│   └── media/               capture tools
└── lib/
    ├── tools/registry.ts    THE registry — nav, search, cards, sitemap,
    │                        related tools, JSON-LD and SEO content derive
    │                        from it; a test enforces live↔loader pairing
    ├── theme.ts             light/dark/system + accent palettes
    └── …                    tested pure helpers (page ranges, wav, color,
                             base32/totp, diff, password, hash, jwt, ico)

public/                      pdf.js worker, libheif + qpdf WASM engines,
                             PWA manifest/service worker, icons, og image
```

### Key design decisions

- **Registry-driven.** A tool exists publicly only when its registry entry is
  `status: "live"` AND a component is registered in `tool-loaders.ts`. A test
  enforces the pairing in both directions.
- **Engines load lazily.** pdf-lib, pdf.js, qpdf, libheif, Tesseract, the
  background-removal model, qrcode, fflate and the docx stack are dynamically
  imported inside action handlers — first-load JS stays ~104 kB.
- **One job state machine.** `useJob` (idle → running → done/error) powers
  every tool: real progress only, friendly errors, elapsed timing, ZIP for
  batches.
- **Tested pure cores.** Page-range parsing, pixel analysis (blank detection,
  ink bounds), invoice math, WAV encoding, base32/TOTP (cross-checked against
  node:crypto), line diff, color/WCAG, password auditing and the ICO
  container all live in dependency-free modules with unit tests.
- **Honest privacy claims.** Every current tool is browser-mode; tool pages
  and the privacy policy say exactly that. If server-side tools are ever
  added, their pages must state where processing happens.
- **PWA.** Manifest + service worker (app-shell caching only, never file
  contents) so installed tools keep working offline.

### ESLint note

`npm run lint` reports 0 errors and a couple dozen warnings from React 19's
`react-hooks/set-state-in-effect` rule. These are intentional patterns —
reading localStorage preferences on mount, resetting derived state when a
picked file changes, and loading lazy engines — documented in
`eslint.config.mjs`, where the rule is set to `warn`.

## Testing

`npm test` — 114 unit tests covering page-range parsing, split modes,
password generation/auditing, case conversion, JSON tools, search ranking,
byte formatting, invoice math, page pixel analysis, ICO packing, WAV
encoding, base32/TOTP (cross-checked against node:crypto), line diff, color
conversion/WCAG and registry integrity (unique routes, live↔loader pairing,
content requirements).

Manual verification against the production build covers every tool's happy
path plus error paths (wrong passwords, camera/screen permission denials,
undecodable files). Lighthouse on the production build: 97/100/100/100
(homepage), 92/100/100/100 (tool page).

## Adding a tool (checklist)

1. Add a registry entry in `src/lib/tools/registry.ts` (`status: "live"` only
   when it works — content fields are required by the integrity test).
2. Create `src/features/<category>/<tool-id>.tsx` using the shared
   components (`ToolWidget`, `FileDropZone`, `useFileQueue`, `useJob`,
   `Results`).
3. Register the loader in `src/features/tool-loaders.ts`.
4. `npm test && npm run lint && npm run build`; verify the flow in the
   browser.

## License

[MIT](LICENSE). The third-party engines bundled or fetched by the tools keep
their own licenses: Next.js (MIT), React (MIT), Tailwind (MIT), pdf-lib
(MIT), @cantoo/pdf-lib (MIT), pdf.js (Apache-2.0), qpdf-wasm (Apache-2.0),
libheif (LGPL-3.0), tesseract.js (Apache-2.0), @imgly/background-removal
(see its package), qrcode (MIT), fflate (MIT), docx (MIT), mammoth (BSD-2),
SheetJS Community (Apache-2.0), lucide-react (ISC). Review before commercial
deployment.
