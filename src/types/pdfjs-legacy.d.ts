/**
 * pdf.js ships first-class types on its main entry; the legacy ESM build (used
 * for bundler compatibility) isn't in the exports map for types. Reuse the
 * main entry's types for the legacy path.
 */
declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export * from "pdfjs-dist";
}
