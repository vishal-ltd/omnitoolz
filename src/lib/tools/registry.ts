import type { Category, ToolDefinition, ToolWithRoute } from "./types";

/**
 * Central tool registry (plan.md §11). Every public surface — navigation,
 * homepage cards, category pages, search, related tools, the sitemap — is
 * derived from this file. A tool must have a working handler component
 * registered in src/features/tool-loaders.ts before it is marked "live".
 */

export const categories: Category[] = [
  {
    id: "pdf",
    slug: "pdf-tools",
    name: "PDF Tools",
    shortName: "PDF",
    description:
      "Merge, split, rotate, extract and convert PDF files — all in your browser.",
    icon: "file-text",
  },
  {
    id: "image",
    slug: "image-tools",
    name: "Image Tools",
    shortName: "Images",
    description:
      "Compress, resize, crop, convert and watermark images without uploading them.",
    icon: "image",
  },
  {
    id: "text",
    slug: "text-tools",
    name: "Text Tools",
    shortName: "Text",
    description: "Counters, converters and cleanups for everyday text work.",
    icon: "type",
  },
  {
    id: "developer",
    slug: "developer-tools",
    name: "Developer Tools",
    shortName: "Developer",
    description: "Formatters and generators for everyday development tasks.",
    icon: "code-2",
  },
  {
    id: "security",
    slug: "security-tools",
    name: "Security Tools",
    shortName: "Security",
    description: "Generate strong passwords and work with everyday security utilities.",
    icon: "shield-check",
  },
  {
    id: "media",
    slug: "media-tools",
    name: "Media Tools",
    shortName: "Media",
    description: "Record your screen and capture your camera — media creation that only a browser can do.",
    icon: "video",
  },
];

const BROWSER_PRIVACY =
  "This tool runs entirely in your browser. Your files never leave your device — there is no upload, no server processing and no storage.";

export const tools: ToolDefinition[] = [
  // ---------------------------------------------------------------- PDF
  {
    id: "merge-pdf",
    name: "Merge PDF",
    description:
      "Combine multiple PDF files into a single document. Reorder files before merging, right in your browser.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    featured: true,
    keywords: ["combine pdf", "join pdf", "pdf combiner", "pdf joiner", "merge documents"],
    icon: "files",
    acceptedFormats: ["PDF"],
    maxFiles: 20,
    maxFileSizeMb: 100,
    supportsBatch: true,
    requiresMultipleFiles: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Drop two or more PDF files into the upload area (or click to browse).",
      "Drag the arrows to put the files in the order you want them to appear in the merged document.",
      "Click “Merge PDFs” and download the combined file.",
    ],
    faqs: [
      {
        q: "Is there a limit on how many PDFs I can merge?",
        a: "You can merge up to 20 files at once, with each file up to 100 MB. Larger batches are possible but may be slow on mobile devices.",
      },
      {
        q: "Will bookmarks and form fields survive the merge?",
        a: "Page content is preserved exactly. Interactive elements such as form fields and the original document bookmarks are not carried over.",
      },
      {
        q: "Can I merge password-protected PDFs?",
        a: "No. Encrypted PDFs must be unlocked first — this tool does not accept them.",
      },
    ],
    relatedToolIds: ["split-pdf", "rotate-pdf", "extract-pdf-pages", "jpg-to-pdf"],
  },
  {
    id: "split-pdf",
    name: "Split PDF",
    description:
      "Split a PDF into separate files by custom page ranges, fixed chunks, or one file per page.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    featured: true,
    keywords: ["divide pdf", "separate pdf", "pdf splitter", "cut pdf", "extract range"],
    icon: "scissors",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload the PDF you want to split.",
      "Choose a split mode: custom ranges (e.g. 1-3, 4-8), fixed chunks of N pages, or one file per page.",
      "Click “Split PDF”. If the result contains several files you will get a ZIP archive.",
    ],
    faqs: [
      {
        q: "How do I write page ranges?",
        a: "Use commas to separate ranges and hyphens for spans — for example “1-3, 5, 8-10”. Pages outside the document are rejected with a clear message.",
      },
      {
        q: "What is a “chunk”?",
        a: "Fixed chunks split the document into equal groups: with 12 pages and a chunk size of 4 you get three files containing pages 1-4, 5-8 and 9-12.",
      },
      {
        q: "How do I get multiple files at once?",
        a: "When a split produces more than one PDF, all results are bundled into a single ZIP you can download with one click.",
      },
    ],
    relatedToolIds: ["merge-pdf", "extract-pdf-pages", "rotate-pdf", "pdf-to-jpg"],
  },
  {
    id: "rotate-pdf",
    name: "Rotate PDF",
    description:
      "Turn pages 90°, 180° or 270° — for every page or just the ones you choose.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["turn pdf", "rotate pages", "landscape portrait", "fix orientation"],
    icon: "rotate-cw",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload the PDF whose pages need rotating.",
      "Pick a rotation angle and, optionally, restrict it to specific pages (e.g. 2, 5-7).",
      "Click “Rotate PDF” and download the corrected file.",
    ],
    faqs: [
      {
        q: "Does rotating reduce quality?",
        a: "No. Rotation only changes page metadata — the page content is untouched and stays pixel-identical.",
      },
      {
        q: "Can I rotate only some pages?",
        a: "Yes. Leave the page range empty to rotate every page, or list the pages to rotate such as “1, 4-6”.",
      },
      {
        q: "The pages were already rotated — what happened?",
        a: "Scanned PDFs sometimes carry a stored rotation. This tool applies rotation on top of the stored value, so 90° twice equals 180°.",
      },
    ],
    relatedToolIds: ["merge-pdf", "split-pdf", "extract-pdf-pages", "pdf-to-jpg"],
  },
  {
    id: "extract-pdf-pages",
    name: "Extract PDF Pages",
    description:
      "Create a new PDF from selected pages of an existing document, in any order you list them.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["pdf extract", "pull pages", "remove pages", "keep pages", "subset pdf"],
    icon: "file-output",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload a PDF.",
      "Type the pages you want to keep, for example “1-3, 9, 12-14”.",
      "Click “Extract Pages” and download the new PDF containing only those pages.",
    ],
    faqs: [
      {
        q: "Can I reorder pages while extracting?",
        a: "Yes. Pages appear in the order you type them, so “9, 1-3” produces page 9 first. Duplicates are ignored.",
      },
      {
        q: "Is this the same as deleting pages?",
        a: "Effectively yes — extracting the pages you keep is the safest way to remove the ones you don't.",
      },
      {
        q: "Does extraction recompress my PDF?",
        a: "No. The original page objects are copied as-is, so text stays selectable and images keep their quality.",
      },
    ],
    relatedToolIds: ["split-pdf", "merge-pdf", "rotate-pdf", "pdf-to-jpg"],
  },
  {
    id: "pdf-to-jpg",
    name: "PDF to JPG",
    description:
      "Convert PDF pages to JPG images at the resolution you choose. Multi-page PDFs come back as a ZIP.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    featured: true,
    keywords: ["pdf to image", "pdf to jpeg", "pdf to picture", "convert pdf pages", "pdf screenshot"],
    icon: "image-down",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload the PDF you want to convert.",
      "Pick an image quality — the DPI setting controls the output resolution.",
      "Click “Convert to JPG” and download the images (ZIP for multi-page documents).",
    ],
    faqs: [
      {
        q: "Which resolution should I pick?",
        a: "96 DPI is fine for screens, 150 DPI works for most sharing, and 300 DPI matches print quality. Higher DPI means larger files.",
      },
      {
        q: "Does it convert scanned PDFs?",
        a: "Yes — pages are rendered exactly as a PDF viewer shows them, whether the content is text or scanned images.",
      },
      {
        q: "Can I convert only some pages?",
        a: "Yes. Fill in an optional page range such as “1-5” to convert a subset of the document.",
      },
    ],
    relatedToolIds: ["jpg-to-pdf", "split-pdf", "extract-pdf-pages", "merge-pdf"],
  },
  {
    id: "jpg-to-pdf",
    name: "JPG to PDF",
    description:
      "Turn JPG, PNG or WebP images into a single PDF — one image per page, in your chosen order.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    featured: true,
    keywords: ["image to pdf", "photo to pdf", "png to pdf", "webp to pdf", "pictures pdf"],
    icon: "file-image",
    acceptedFormats: ["JPG", "PNG", "WebP"],
    maxFiles: 30,
    maxFileSizeMb: 30,
    supportsBatch: true,
    requiresMultipleFiles: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload one or more images (JPG, PNG or WebP).",
      "Reorder them if needed and choose a page size — automatic (matches each image) or a paper format such as A4.",
      "Click “Create PDF” and download the document.",
    ],
    faqs: [
      {
        q: "What does “Automatic page size” mean?",
        a: "Each page is sized to match its image, so nothing is scaled or cropped. Choose A4 or Letter to fit images onto standard paper with a margin.",
      },
      {
        q: "Are images recompressed?",
        a: "JPG and PNG images are embedded without re-encoding whenever possible, so quality and file size stay close to the originals.",
      },
      {
        q: "Can I mix formats in one PDF?",
        a: "Yes — combine JPG, PNG and WebP freely; each becomes one page in the order shown in the list.",
      },
    ],
    relatedToolIds: ["merge-pdf", "pdf-to-jpg", "compress-image", "resize-image"],
  },
  {
    id: "add-page-numbers",
    name: "Add Page Numbers to PDF",
    description:
      "Stamp page numbers onto a PDF with control over position, format, starting number and font size.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["number pages", "pdf numbering", "pagenumbers", "pagination", "footer numbers"],
    icon: "hash",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload a PDF.",
      "Choose the position, number format, starting number and font size.",
      "Click “Add Page Numbers” and download the numbered PDF.",
    ],
    faqs: [
      {
        q: "Can I skip the cover page?",
        a: "Yes. Set “Start numbering at page” to 2 to leave the first page clean, or adjust the starting number if page 2 should show “2”.",
      },
      {
        q: "Which formats are available?",
        a: "Plain numbers (“3”), “3 / 12” and “Page 3 of 12”. More formats arrive with feedback.",
      },
      {
        q: "Will existing text be overwritten?",
        a: "Numbers are drawn in the chosen corner with a small margin. If the area is already crowded, pick a different position.",
      },
    ],
    relatedToolIds: ["merge-pdf", "rotate-pdf", "extract-pdf-pages", "split-pdf"],
  },
  {
    id: "protect-pdf",
    name: "Protect PDF with Password",
    description:
      "Add a password to a PDF with AES-256 encryption. Choose what readers may print or copy — all in your browser.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    featured: true,
    keywords: ["password protect pdf", "encrypt pdf", "lock pdf", "secure pdf", "pdf password"],
    icon: "lock",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote:
      "Encryption happens entirely in your browser with AES-256. Your document and password never leave your device.",
    howTo: [
      "Upload the PDF you want to protect.",
      "Choose a password and set what readers are allowed to do (print, copy text).",
      "Click “Protect PDF” — anyone opening the file will now need the password.",
    ],
    faqs: [
      {
        q: "How strong is the encryption?",
        a: "AES-256 — the same cipher modern PDF viewers use for their strongest protection. It is the only algorithm ISO 32000-2 still recommends.",
      },
      {
        q: "What if I forget the password?",
        a: "There is no backdoor and we never see the password. Store it in a password manager — without it the file cannot be opened.",
      },
      {
        q: "Can I protect an already-protected PDF?",
        a: "No — unlock it first, then protect it again with the new password.",
      },
    ],
    relatedToolIds: ["unlock-pdf", "organize-pdf", "watermark-pdf", "merge-pdf"],
  },
  {
    id: "unlock-pdf",
    name: "Unlock PDF",
    description:
      "Remove the password from a PDF you own. Enter the current password and download a copy that opens without one.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    featured: true,
    keywords: ["remove pdf password", "decrypt pdf", "unlock pdf", "open protected pdf", "pdf password remover"],
    icon: "lock-open",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote:
      "Decryption happens entirely in your browser. Your document and password never leave your device.",
    howTo: [
      "Upload the password-protected PDF.",
      "Type the password you normally open it with.",
      "Click “Remove Password” and download the unlocked copy.",
    ],
    faqs: [
      {
        q: "Can this crack a password I don't know?",
        a: "No — and that's the point. The tool only removes protection from files you can already open. There is no guessing or brute-forcing.",
      },
      {
        q: "Will the unlocked copy keep everything?",
        a: "Yes — pages, text, images and forms are preserved. Only the password requirement is gone.",
      },
      {
        q: "The file says it's locked but no password was needed?",
        a: "Some PDFs carry an owner password (restrictions only) and open freely. The tool removes those restrictions and re-saves a clean copy.",
      },
    ],
    relatedToolIds: ["protect-pdf", "merge-pdf", "organize-pdf", "extract-pdf-text"],
  },
  {
    id: "organize-pdf",
    name: "Organize PDF Pages",
    description:
      "Rearrange, rotate or delete pages on a visual grid of thumbnails — drag pages into order, then download the new PDF.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    featured: true,
    keywords: ["reorder pdf pages", "rearrange pdf", "organize pdf", "sort pages", "pdf page manager"],
    icon: "layout-grid",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload a PDF — a thumbnail of every page appears.",
      "Drag pages (or use the arrows) to reorder, rotate single pages, or delete the ones you don't need.",
      "Click “Apply Changes” and download the reorganized document.",
    ],
    faqs: [
      {
        q: "How do I delete pages here?",
        a: "Hover a page thumbnail and click the trash button. Deleted pages are simply excluded when the new PDF is built.",
      },
      {
        q: "Can I rotate just one page?",
        a: "Yes — each thumbnail has its own rotate button, so a single sideways scan can be fixed without touching the rest.",
      },
      {
        q: "Is the quality affected?",
        a: "No. Pages are copied as-is; only their order and rotation metadata change.",
      },
    ],
    relatedToolIds: ["delete-pdf-pages", "split-pdf", "merge-pdf", "rotate-pdf"],
  },
  {
    id: "delete-pdf-pages",
    name: "Delete PDF Pages",
    description:
      "Remove selected pages from a PDF by typing their numbers — the fastest way to drop a blank scan or an old page.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["remove pages pdf", "delete page from pdf", "cut pages out", "drop pdf pages"],
    icon: "file-minus-2",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload the PDF.",
      "Type the pages to delete, for example “2, 5-7”.",
      "Click “Delete Pages” and download the shorter document.",
    ],
    faqs: [
      {
        q: "Can I delete all pages?",
        a: "No — a PDF needs at least one page. If you select everything, the tool asks you to keep at least one.",
      },
      {
        q: "Is deleting the same as extracting the rest?",
        a: "Yes, and both preserve the original page objects, so quality never changes.",
      },
      {
        q: "Need to see pages before choosing?",
        a: "Use “Organize PDF Pages” — it shows a thumbnail grid with delete buttons.",
      },
    ],
    relatedToolIds: ["organize-pdf", "extract-pdf-pages", "split-pdf", "rotate-pdf"],
  },
  {
    id: "watermark-pdf",
    name: "Watermark PDF",
    description:
      "Stamp a text watermark — DRAFT, CONFIDENTIAL, your name — across every page, straight or diagonal.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["pdf watermark", "stamp pdf", "draft stamp", "confidential pdf", "copyright pdf"],
    icon: "stamp",
    acceptedFormats: ["PDF"],
    maxFiles: 20,
    maxFileSizeMb: 100,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload one or more PDFs.",
      "Type the watermark text, pick size, color, opacity, position and straight or diagonal.",
      "Click “Add Watermark” and download the stamped files.",
    ],
    faqs: [
      {
        q: "Can readers remove the watermark?",
        a: "It is drawn into the page content, so casual removal isn't possible — but no watermark is a substitute for encryption. Use “Protect PDF” for real access control.",
      },
      {
        q: "Why does opacity matter?",
        a: "Low opacity keeps the text underneath readable; high opacity makes the status unmistakable. 15-30% works for most documents.",
      },
      {
        q: "Can I watermark several files at once?",
        a: "Yes — up to 20 PDFs per batch, each stamped identically and returned as a ZIP.",
      },
    ],
    relatedToolIds: ["protect-pdf", "header-footer-pdf", "add-page-numbers", "merge-pdf"],
  },
  {
    id: "header-footer-pdf",
    name: "Add Header & Footer to PDF",
    description:
      "Put custom text at the top and bottom of every page — titles, dates, file names or page numbers in any corner.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["pdf header", "pdf footer", "add text to pdf pages", "document title on every page"],
    icon: "panel-top",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload a PDF.",
      "Fill in the header and/or footer lines — left, center and right each take their own text.",
      "Click “Add Header & Footer” and download the updated document.",
    ],
    faqs: [
      {
        q: "Can I insert the date or page numbers?",
        a: "Yes. Use {page} for the page number, {total} for the page count and {date} for today's date — they're replaced per page.",
      },
      {
        q: "Will it overwrite existing text?",
        a: "New text is drawn in the chosen corners with a small margin. If those spots are already full, shift your text to another position.",
      },
      {
        q: "Can the first page be left clean?",
        a: "Yes — enable “Skip the first page” for a cover page without a header or footer.",
      },
    ],
    relatedToolIds: ["add-page-numbers", "watermark-pdf", "merge-pdf", "extract-pdf-text"],
  },
  {
    id: "extract-pdf-text",
    name: "Extract PDF Text",
    description:
      "Lift the text out of a PDF into a plain .txt file — per page or the whole document, ready to copy and reuse.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["pdf to text", "extract text from pdf", "copy pdf text", "pdf text extractor", "get words from pdf"],
    icon: "file-text",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload a PDF.",
      "Optionally limit the extraction to a page range.",
      "Click “Extract Text” and download the .txt file — page markers show where each page begins.",
    ],
    faqs: [
      {
        q: "Does it work with scanned PDFs?",
        a: "Only if the scan already contains a text layer (OCR). Pure image scans have no text to extract — you'd need an OCR service first.",
      },
      {
        q: "Will formatting be kept?",
        a: "No — the output is plain text with line breaks. Bold, colors and exact columns are not representable in .txt.",
      },
      {
        q: "What languages are supported?",
        a: "Any text the PDF stores with a Unicode mapping, including non-Latin scripts. Password-protected files must be unlocked first.",
      },
    ],
    relatedToolIds: ["pdf-information", "pdf-to-jpg", "split-pdf", "unlock-pdf"],
  },
  {
    id: "pdf-information",
    name: "PDF Document Info",
    description:
      "Inspect a PDF before sharing it — page count and sizes, title, author, creation date, encryption and file size.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["pdf metadata viewer", "pdf info", "pdf page size", "check pdf properties", "pdf details"],
    icon: "info",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload a PDF.",
      "Read the report: pages, page dimensions, title and author, dates, producer and encryption state.",
      "Want a clean copy without those details? Use “Clean PDF” to strip them.",
    ],
    faqs: [
      {
        q: "Why check document info?",
        a: "Metadata can reveal your name, software and editing history. This report shows exactly what a recipient would see before you send the file.",
      },
      {
        q: "What do “creation” and “modification” dates mean?",
        a: "They are stored inside the PDF, set by whatever produced or last edited it. They may not match your file system.",
      },
      {
        q: "Can I edit the metadata here?",
        a: "Not yet — for now you can strip it entirely with “Clean PDF”, which also resets the dates.",
      },
    ],
    relatedToolIds: ["clean-pdf", "extract-pdf-text", "protect-pdf", "compare-pdf"],
  },
  {
    id: "clean-pdf",
    name: "Clean PDF",
    description:
      "Strip hidden metadata and remove comments and annotations in one pass — share documents without the leftovers.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["remove pdf metadata", "clean pdf", "delete annotations", "remove comments from pdf", "sanitize pdf"],
    icon: "eraser",
    acceptedFormats: ["PDF"],
    maxFiles: 20,
    maxFileSizeMb: 100,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload one or more PDFs.",
      "Choose what to remove: hidden metadata, comments & annotations, and the bookmark outline.",
      "Click “Clean PDF” and download the sanitized files.",
    ],
    faqs: [
      {
        q: "What exactly is “hidden metadata”?",
        a: "The document title, author, subject, keywords, creator app and producer — plus internal timestamps. All are reset to empty.",
      },
      {
        q: "Does cleaning affect page content?",
        a: "No. Text, images and layout are untouched; only information about the document and its annotations is removed.",
      },
      {
        q: "Are form fields removed too?",
        a: "No — forms keep working. Comments, highlights, sticky notes and drawn annotations are what gets deleted.",
      },
    ],
    relatedToolIds: ["pdf-information", "protect-pdf", "flatten-pdf", "merge-pdf"],
  },
  {
    id: "flatten-pdf",
    name: "Flatten PDF Forms",
    description:
      "Bake filled form fields into the page so answers can't be edited — ideal before submitting or archiving.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["flatten pdf", "flatten form fields", "lock pdf form", "bake form answers", "pdf form to flat"],
    icon: "layers",
    acceptedFormats: ["PDF"],
    maxFiles: 20,
    maxFileSizeMb: 100,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload one or more PDFs with form fields.",
      "Click “Flatten Forms”.",
      "Download copies where every filled field has become permanent page content.",
    ],
    faqs: [
      {
        q: "What does flattening do exactly?",
        a: "Each field is drawn into the page as ordinary content and the interactive field is removed — the answers become as permanent as printed text.",
      },
      {
        q: "Can a flattened form be un-flattened?",
        a: "No. The fields are gone; only the drawn text remains. Keep the original if you may need to edit the answers later.",
      },
      {
        q: "What about layers and transparency?",
        a: "This tool flattens form fields only. PDF layers (OCGs) are preserved as-is.",
      },
    ],
    relatedToolIds: ["clean-pdf", "protect-pdf", "organize-pdf", "merge-pdf"],
  },
  {
    id: "repair-pdf",
    name: "Repair PDF",
    description:
      "Try to recover a PDF that won't open by rebuilding its structure. Fixes minor damage; can't resurrect missing data.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["fix pdf", "repair pdf", "corrupt pdf recovery", "damaged pdf", "pdf wont open"],
    icon: "wrench",
    acceptedFormats: ["PDF"],
    maxFiles: 20,
    maxFileSizeMb: 100,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload the damaged PDF (or several).",
      "Click “Repair PDF” — the document structure is re-read and re-saved cleanly.",
      "Download the recovered copy and check it opens in your viewer.",
    ],
    faqs: [
      {
        q: "What can be repaired?",
        a: "Broken cross-reference tables, truncated object streams and other structural hiccups — the kinds of damage that make viewers shrug while the content is still there.",
      },
      {
        q: "What can't be repaired?",
        a: "Pages whose bytes are truly missing (a truncated download), and encrypted files without their password. No tool can restore data that isn't in the file.",
      },
      {
        q: "Will repair change my document?",
        a: "It re-saves the structure; page content is copied unchanged. If the original opens fine, there's nothing to gain.",
      },
    ],
    relatedToolIds: ["pdf-information", "unlock-pdf", "merge-pdf", "organize-pdf"],
  },
  {
    id: "crop-pdf",
    name: "Crop PDF",
    description:
      "Trim the white space around PDF pages — automatically detected, or by exact margins you choose.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["crop pdf", "trim pdf margins", "remove white space pdf", "cut pdf edges", "pdf whitespace"],
    icon: "crop",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload a PDF.",
      "Pick “Auto-trim white space” or set exact margins in millimetres for every side.",
      "Click “Crop PDF” and download the tightened document.",
    ],
    faqs: [
      {
        q: "How does auto-trim decide where to cut?",
        a: "Each page is rendered and the smallest rectangle containing all visible content is measured; a small safety margin is kept. You can also cap the maximum trim.",
      },
      {
        q: "Is content ever deleted?",
        a: "No — cropping sets the visible area. The full original content is still in the file; printers and viewers just show the cropped window.",
      },
      {
        q: "Can cropping make pages bigger?",
        a: "Never. Auto-trim only shrinks the visible area, and manual margins are clamped so the result always fits inside the page.",
      },
    ],
    relatedToolIds: ["organize-pdf", "remove-blank-pages", "pdf-to-jpg", "merge-pdf"],
  },
  {
    id: "remove-blank-pages",
    name: "Remove Blank Pages",
    description:
      "Detect and drop blank pages from a PDF automatically — perfect for two-sided scans with empty backs.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["remove blank pages pdf", "delete empty pages", "scan cleanup", "blank page detector"],
    icon: "file-minus",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload a PDF.",
      "Adjust the sensitivity if needed — “Normal” catches pure-white pages, “Aggressive” also catches faint marks.",
      "Click “Remove Blank Pages” and download the tighter document.",
    ],
    faqs: [
      {
        q: "How is a blank page detected?",
        a: "Every page is rendered and checked for ink. A page whose visible content stays under a tiny threshold counts as blank.",
      },
      {
        q: "Could it remove a page I want to keep?",
        a: "Only pages that are visually empty. If a faint stamp or signature matters to you, use “Normal” sensitivity — it requires a page to be essentially pure white.",
      },
      {
        q: "What if every page is blank?",
        a: "The tool refuses to produce an empty PDF and tells you instead.",
      },
    ],
    relatedToolIds: ["crop-pdf", "organize-pdf", "delete-pdf-pages", "rotate-pdf"],
  },
  {
    id: "compare-pdf",
    name: "Compare PDFs",
    description:
      "Put two PDFs side by side — page counts, sizes, metadata and which pages' text differs, in one quick report.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["compare pdf", "pdf diff", "check pdf differences", "pdf versions compare"],
    icon: "scale",
    acceptedFormats: ["PDF"],
    maxFiles: 2,
    maxFileSizeMb: 100,
    supportsBatch: false,
    requiresMultipleFiles: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload the original and the revised PDF.",
      "Click “Compare”.",
      "Read the report: what changed in size and page count, and which pages have different text.",
    ],
    faqs: [
      {
        q: "What exactly is compared?",
        a: "Page counts, file sizes, document metadata, and the text of every page. Pages whose extracted text differs are listed by number.",
      },
      {
        q: "Can it spot visual changes like image edits?",
        a: "No — this is a text-level comparison, which covers most document revisions honestly. Image-only changes are reported only if metadata or size hints at them.",
      },
      {
        q: "Does order matter?",
        a: "Only for the labels “Original” and “Revised” — the differences found are the same either way.",
      },
    ],
    relatedToolIds: ["pdf-information", "extract-pdf-text", "merge-pdf", "split-pdf"],
  },
  {
    id: "extract-pdf-images",
    name: "Extract Images from PDF",
    description:
      "Save the pictures stored inside a PDF as individual image files — photos and scans come out at original quality.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["extract images from pdf", "save pdf images", "get pictures from pdf", "pdf image exporter"],
    icon: "image-plus",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload a PDF.",
      "Click “Extract Images”.",
      "Download the embedded pictures — several files arrive as a ZIP.",
    ],
    faqs: [
      {
        q: "Which images can be extracted?",
        a: "Embedded raster pictures — the JPEG-encoded images that make up most photos and scans in PDFs — come out byte-for-byte at original quality.",
      },
      {
        q: "What about charts and vector graphics?",
        a: "Vector drawings aren't stored as pictures, so they have no image file to extract. Screenshot the page with “PDF to JPG” instead.",
      },
      {
        q: "Why did some images extract but not others?",
        a: "Some PDFs store pictures in less common encodings. The report tells you exactly how many were recovered.",
      },
    ],
    relatedToolIds: ["pdf-to-jpg", "extract-pdf-text", "organize-pdf", "split-pdf"],
  },
  {
    id: "read-pdf",
    name: "Read PDF",
    description:
      "Open and read any PDF right in your browser — then hand it straight to another tool without re-uploading.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["pdf viewer", "read pdf online", "open pdf in browser", "view pdf privately"],
    icon: "book-open",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote:
      "This viewer renders pages locally. The file stays in your browser's memory and is never uploaded.",
    howTo: [
      "Drop a PDF into the viewer.",
      "Read it — zoom in or out, and jump between pages.",
      "Use “Continue with…” to send the same file to another tool without picking it again.",
    ],
    faqs: [
      {
        q: "Why use this instead of my desktop viewer?",
        a: "It opens files that some viewers refuse, needs no installation, and connects directly to the other tools — merge, split, protect — without re-uploading.",
      },
      {
        q: "Are password-protected files supported?",
        a: "Not yet — unlock the file first with “Unlock PDF”, then read it here.",
      },
      {
        q: "How big a PDF can it handle?",
        a: "Documents of a few hundred pages render fine; very large files simply take longer to show the first page.",
      },
    ],
    relatedToolIds: ["organize-pdf", "extract-pdf-text", "protect-pdf", "pdf-to-jpg"],
  },
  {
    id: "invoice-generator",
    name: "Invoice Generator",
    description:
      "Create a clean PDF invoice, receipt or quote with line items and tax — fill the form, download, send.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    featured: true,
    keywords: ["invoice generator", "make invoice pdf", "receipt maker", "quote pdf", "free invoice template"],
    icon: "receipt",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote:
      "Invoices are generated entirely in your browser — your client details and pricing never leave your device.",
    howTo: [
      "Pick the document type: invoice, receipt or quote.",
      "Fill in your details, the client, line items and tax.",
      "Click “Generate PDF” and download the finished document.",
    ],
    faqs: [
      {
        q: "Is it really free and unlimited?",
        a: "Yes — there's no account, no watermark on your documents and no limit on how many you generate.",
      },
      {
        q: "Which currencies work?",
        a: "Dollar, euro, pound and rupees are quick picks, or type any symbol. The rupee is drawn as “Rs.” — standard PDF fonts don't include the ₹ glyph. Amounts get thousands separators automatically.",
      },
      {
        q: "Can I edit the PDF afterwards?",
        a: "The output is a normal PDF, but for changes it's easiest to come back, adjust the form and regenerate — your last inputs stay until you reset.",
      },
    ],
    relatedToolIds: ["protect-pdf", "merge-pdf", "watermark-pdf", "add-page-numbers"],
  },
  {
    id: "sign-pdf",
    name: "Sign PDF",
    description:
      "Draw or type your signature and stamp it exactly where you tap on the page — no account, no upload.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["sign pdf", "add signature pdf", "esign", "signature stamp", "draw signature"],
    icon: "pen-line",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Drop the PDF that needs signing.",
      "Draw your signature on the pad, or type it and pick the size.",
      "Tap the page where it goes — or stamp every page — then download the signed copy.",
    ],
    faqs: [
      {
        q: "Is this a legal signature?",
        a: "It places your signature image on the document like a wet-ink signature. Whether it legally binds depends on your jurisdiction and agreement — for certified, tamper-evident signing you need a certificate authority.",
      },
      {
        q: "Can others remove the signature?",
        a: "It becomes ordinary page content, so determined editors can crop it — same as a printed signature. Pair it with Protect PDF for access control.",
      },
      {
        q: "Where should I place it?",
        a: "The usual spot is near the signature line. Tap precisely on the preview — a dashed outline shows the footprint before you apply.",
      },
    ],
    relatedToolIds: ["protect-pdf", "organize-pdf", "watermark-pdf", "read-pdf"],
  },
  {
    id: "camera-scan-pdf",
    name: "Camera Scan to PDF",
    description:
      "Point your phone's camera at pages, capture as many as you need, and build a PDF on the spot — no upload.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["camera scanner", "scan documents", "scan to pdf", "document scanner", "camera to pdf"],
    icon: "camera",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Open the camera (your phone's rear camera is picked automatically).",
      "Capture each page — delete any shot you don't want.",
      "Choose a page size and margin, then build the PDF right on the device.",
    ],
    faqs: [
      {
        q: "How is this different from JPG to PDF?",
        a: "It captures instead of uploading: the camera, preview, retakes and PDF assembly all happen on the device in one flow.",
      },
      {
        q: "Does it enhance the scan?",
        a: "The full-frame capture is honest but plain — edge detection and deskewing are on the roadmap. Good lighting helps more than any filter.",
      },
      {
        q: "Where do the shots go?",
        a: "Nowhere. They live in the tab's memory until you build the PDF or close the page.",
      },
    ],
    relatedToolIds: ["jpg-to-pdf", "ocr", "rotate-pdf", "merge-pdf"],
  },
  {
    id: "pptx-to-pdf",
    name: "PowerPoint to PDF",
    description:
      "Convert .pptx decks to PDF slides. Coming once slide rendering meets our fidelity bar — text-only conversions of slides mislead more than they help.",
    category: "pdf",
    processingMode: "browser",
    status: "planned",
    keywords: ["pptx to pdf", "powerpoint converter", "slides to pdf"],
    icon: "file-text",
    acceptedFormats: ["PPTX"],
    maxFiles: 1,
    maxFileSizeMb: 50,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [],
    faqs: [],
    relatedToolIds: [],
  },
  {
    id: "word-to-pdf",
    name: "Word to PDF",
    description:
      "Convert Word .docx documents to clean PDF text layouts — headings, paragraphs, lists and tables, all on your device.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["word to pdf", "docx to pdf", "convert word", "document converter", "docx converter"],
    icon: "file-text",
    acceptedFormats: ["DOCX"],
    maxFiles: 5,
    maxFileSizeMb: 30,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Drop .docx files (up to 5).",
      "Click “Convert to PDF”.",
      "Download clean PDF copies — no upload involved.",
    ],
    faqs: [
      {
        q: "Will it look exactly like Word?",
        a: "No — this is an honest text re-layout: headings, paragraphs, lists and simple tables become clean PDF text. Images and pixel-perfect formatting don't carry over. For pixel-perfect output, print to PDF from Word itself.",
      },
      {
        q: "What about .doc files?",
        a: "The legacy .doc format can't be parsed safely in a browser. Save as .docx from Word first — it takes one click.",
      },
      {
        q: "Where does the document go?",
        a: "Nowhere. mammoth.js parses it in your tab and pdf-lib writes the PDF locally.",
      },
    ],
    relatedToolIds: ["excel-to-pdf", "pdf-to-word", "compress-pdf", "merge-pdf"],
  },
  {
    id: "excel-to-pdf",
    name: "Excel to PDF",
    description:
      "Turn spreadsheets into landscape PDF text grids — every sheet, every value, gridlines included, all locally.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["excel to pdf", "xlsx to pdf", "spreadsheet converter", "csv to pdf", "sheet to pdf"],
    icon: "file-text",
    acceptedFormats: ["XLSX", "XLS", "CSV"],
    maxFiles: 5,
    maxFileSizeMb: 30,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Drop .xlsx, .xls or .csv files (up to 5).",
      "Adjust scale and gridline options.",
      "Download landscape PDFs — one section per sheet.",
    ],
    faqs: [
      {
        q: "How are wide sheets handled?",
        a: "Columns shrink to fit the page width; drop the scale slider if it gets too small. Very wide sheets stay readable as monospace text grids.",
      },
      {
        q: "Do formulas and charts convert?",
        a: "Values convert — computed results, not the formulas. Charts, colors and merged-cell layouts don't carry over; this is a data-first converter.",
      },
      {
        q: "Is CSV supported?",
        a: "Yes — a CSV becomes a single-sheet workbook and flows through the same pipeline.",
      },
    ],
    relatedToolIds: ["word-to-pdf", "pdf-to-word", "compress-pdf", "extract-pdf-text"],
  },
  {
    id: "pdf-to-word",
    name: "PDF to Word",
    description:
      "Convert a PDF into an editable .docx — paragraphs rebuilt from the text layer, ready for Word or Google Docs.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    keywords: ["pdf to word", "pdf to docx", "edit pdf in word", "pdf converter", "extract to docx"],
    icon: "file-text",
    acceptedFormats: ["PDF"],
    maxFiles: 1,
    maxFileSizeMb: 100,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Drop a text-based PDF.",
      "Click “Convert to Word”.",
      "Download the .docx — paragraphs rebuilt, ready to edit.",
    ],
    faqs: [
      {
        q: "How good is the result?",
        a: "Text comes through as editable paragraphs, with sensible paragraph breaks rebuilt from the layout. Images, columns and exact positioning don't carry over — this is for editing content, not reproducing design.",
      },
      {
        q: "Scanned PDFs?",
        a: "They have no text layer to convert. Run them through “Image to Text (OCR)” after a “PDF to JPG” pass, then paste the text into any editor.",
      },
      {
        q: "Where does the .docx come from?",
        a: "Built locally by the docx library in your tab — the file is written on your device and opened by you.",
      },
    ],
    relatedToolIds: ["word-to-pdf", "extract-pdf-text", "excel-to-pdf", "pdf-to-jpg"],
  },
  {
    id: "compress-pdf",
    name: "Compress PDF",
    description:
      "Losslessly shrink PDFs with a qpdf WebAssembly build — recompressed streams and object packing, never re-encoded content.",
    category: "pdf",
    processingMode: "browser",
    status: "live",
    featured: true,
    keywords: ["reduce pdf size", "shrink pdf", "smaller pdf", "compress pdf", "optimize pdf"],
    icon: "minimize-2",
    acceptedFormats: ["PDF"],
    maxFiles: 10,
    maxFileSizeMb: 100,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Drop one or more PDFs (up to 10).",
      "Optionally enable linearize for fast page-by-page web loading.",
      "Click “Compress PDF” — every result keeps full quality, and files that are already optimal pass through unchanged.",
    ],
    faqs: [
      {
        q: "Is this lossless?",
        a: "Yes — streams are re-packed and deduplicated, never re-encoded. Text stays crisp, images keep every pixel. The qpdf engine is the same one backing many desktop tools.",
      },
      {
        q: "Why didn't my scanned PDF shrink?",
        a: "Scans are usually one big JPEG per page — already compressed, so structure-only optimization can't help. For those, use “PDF to JPG” and rebuild, accepting quality loss.",
      },
      {
        q: "What does linearize do?",
        a: "It reorganizes the file so the first page renders before the whole download finishes — worth it for PDFs served on the web.",
      },
    ],
    relatedToolIds: ["pdf-to-jpg", "clean-pdf", "merge-pdf", "protect-pdf"],
  },

  // ------------------------------------------------------------- Images
  {
    id: "compress-image",
    name: "Compress Image",
    description:
      "Shrink JPG, PNG and WebP files with a quality slider and optional dimension cap — and see the savings before downloading.",
    category: "image",
    processingMode: "browser",
    status: "live",
    featured: true,
    keywords: ["reduce image size", "image optimizer", "smaller jpg", "compress png", "compress webp"],
    icon: "shrink",
    acceptedFormats: ["JPG", "PNG", "WebP"],
    maxFiles: 20,
    maxFileSizeMb: 30,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload one or more images.",
      "Choose the output quality and, optionally, a maximum dimension to downscale large photos.",
      "Click “Compress” — you'll see the before/after size for every file before downloading.",
    ],
    faqs: [
      {
        q: "What quality setting should I use?",
        a: "75 is a good default for photos. Use 85-90 when detail matters, or 60 for maximum savings where slight softness is acceptable.",
      },
      {
        q: "Why did my PNG get bigger?",
        a: "PNGs with few colors compress well, but photographic PNGs re-encoded as PNG can grow. Choose WebP or JPG output for photos to get real savings.",
      },
      {
        q: "Is compression done on a server?",
        a: "No. Everything happens in your browser — the images are never uploaded.",
      },
    ],
    relatedToolIds: ["resize-image", "webp-converter", "png-to-jpg", "crop-image"],
  },
  {
    id: "resize-image",
    name: "Resize Image",
    description:
      "Change image dimensions by pixels or percentage, with the aspect ratio locked or free.",
    category: "image",
    processingMode: "browser",
    status: "live",
    featured: true,
    keywords: ["scale image", "change dimensions", "image resizer", "make image smaller", "upscale"],
    icon: "maximize-2",
    acceptedFormats: ["JPG", "PNG", "WebP"],
    maxFiles: 10,
    maxFileSizeMb: 30,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload one or more images.",
      "Enter a width and height, or use the percentage slider. The lock keeps the aspect ratio.",
      "Click “Resize” and download the results.",
    ],
    faqs: [
      {
        q: "What happens with several images of different sizes?",
        a: "Percentage mode scales each image relative to its own dimensions. Exact pixel mode applies the same target size to every image.",
      },
      {
        q: "Does resizing reduce quality?",
        a: "Downscaling keeps good quality; upscaling makes images softer because pixels must be invented. Start from the largest original you have.",
      },
      {
        q: "Can I change the format while resizing?",
        a: "Yes — keep the original format or output PNG, JPG or WebP.",
      },
    ],
    relatedToolIds: ["crop-image", "compress-image", "watermark-image", "webp-converter"],
  },
  {
    id: "crop-image",
    name: "Crop Image",
    description:
      "Trim an image to exact pixel bounds or an aspect-ratio preset with a live preview.",
    category: "image",
    processingMode: "browser",
    status: "live",
    keywords: ["cut image", "trim image", "aspect ratio", "square photo", "crop png"],
    icon: "crop",
    acceptedFormats: ["JPG", "PNG", "WebP"],
    maxFiles: 1,
    maxFileSizeMb: 30,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload an image — a live preview appears.",
      "Set the crop area by numbers or use a preset (square, 16:9, 4:3, 3:2) for a centered crop.",
      "Click “Crop & Download”. Use “Reset” to start over.",
    ],
    faqs: [
      {
        q: "How do the presets work?",
        a: "Presets pick the largest possible area with that aspect ratio, centered in the image. You can then fine-tune the numbers.",
      },
      {
        q: "Can I crop outside the image?",
        a: "No — the crop is clamped to the image bounds, so every output pixel is real image data.",
      },
      {
        q: "What about the output format?",
        a: "The download keeps the original format (PNG stays PNG so transparency survives).",
      },
    ],
    relatedToolIds: ["resize-image", "compress-image", "watermark-image", "jpg-to-png"],
  },
  {
    id: "jpg-to-png",
    name: "JPG to PNG",
    description:
      "Convert JPG images to PNG — useful when you need a lossless format or wider tool compatibility.",
    category: "image",
    processingMode: "browser",
    status: "live",
    keywords: ["jpeg to png", "convert jpg", "jpg converter", "png output"],
    icon: "arrow-left-right",
    acceptedFormats: ["JPG"],
    maxFiles: 20,
    maxFileSizeMb: 30,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload one or more JPG images.",
      "Click “Convert to PNG”.",
      "Download the converted files — a ZIP is produced for batches.",
    ],
    faqs: [
      {
        q: "Will converting JPG to PNG improve quality?",
        a: "No — the JPEG artifacts are already baked in. PNG just prevents further loss from now on and usually makes the file larger.",
      },
      {
        q: "Can I convert many files at once?",
        a: "Yes, up to 20 files per batch; multiple results download as one ZIP.",
      },
      {
        q: "Is there a size limit?",
        a: "Each file can be up to 30 MB, which covers most photos.",
      },
    ],
    relatedToolIds: ["png-to-jpg", "webp-converter", "compress-image", "resize-image"],
  },
  {
    id: "png-to-jpg",
    name: "PNG to JPG",
    description:
      "Convert PNG images to JPG with a quality slider and a background color for transparent areas.",
    category: "image",
    processingMode: "browser",
    status: "live",
    keywords: ["convert png", "png converter", "jpeg output", "remove transparency"],
    icon: "arrow-left-right",
    acceptedFormats: ["PNG"],
    maxFiles: 20,
    maxFileSizeMb: 30,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload one or more PNG images.",
      "Pick the JPG quality and the background color used where the PNG is transparent.",
      "Click “Convert to JPG” and download.",
    ],
    faqs: [
      {
        q: "What happens to transparency?",
        a: "JPG has no transparency, so transparent pixels are filled with your chosen background color (white by default).",
      },
      {
        q: "Why is the JPG smaller than my PNG?",
        a: "JPG's lossy compression is efficient for photographs. For screenshots and flat graphics the savings may be small.",
      },
      {
        q: "Which quality should I choose?",
        a: "90 keeps near-identical appearance; 75-80 is a strong default for the web.",
      },
    ],
    relatedToolIds: ["jpg-to-png", "webp-converter", "compress-image", "resize-image"],
  },
  {
    id: "webp-converter",
    name: "WebP Converter",
    description:
      "Convert images to modern WebP for smaller files, or from WebP to JPG/PNG when you need classic formats.",
    category: "image",
    processingMode: "browser",
    status: "live",
    keywords: ["convert webp", "to webp", "from webp", "webp to jpg", "webp to png", "png to webp"],
    icon: "arrow-left-right",
    acceptedFormats: ["JPG", "PNG", "WebP"],
    maxFiles: 20,
    maxFileSizeMb: 30,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload your images.",
      "Choose the output: to WebP (with quality slider), or from WebP to JPG/PNG.",
      "Click “Convert” and download — batches arrive as a ZIP.",
    ],
    faqs: [
      {
        q: "Which direction do I need?",
        a: "Converting to WebP usually shrinks photos for the web by 25-35%. Converting from WebP is for older apps that don't accept WebP.",
      },
      {
        q: "Does every browser support WebP?",
        a: "All modern browsers do. Very old browsers (pre-2020) may not, which is the main reason to convert away from WebP.",
      },
      {
        q: "Is WebP lossless or lossy?",
        a: "It can be both — this tool produces lossy WebP at the quality you choose, which is right for photos.",
      },
    ],
    relatedToolIds: ["compress-image", "jpg-to-png", "png-to-jpg", "resize-image"],
  },
  {
    id: "watermark-image",
    name: "Watermark Image",
    description:
      "Add a text watermark over your images with control over position, size, color and opacity.",
    category: "image",
    processingMode: "browser",
    status: "live",
    keywords: ["text watermark", "stamp image", "copyright photo", "protect images", "overlay text"],
    icon: "stamp",
    acceptedFormats: ["JPG", "PNG", "WebP"],
    maxFiles: 20,
    maxFileSizeMb: 30,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload one or more images.",
      "Type the watermark text and choose position, size, color and opacity.",
      "Click “Add Watermark” and download the protected images.",
    ],
    faqs: [
      {
        q: "Is the watermark removable?",
        a: "A visible watermark over image content is a deterrent, not a guarantee — determined editors can retouch it away.",
      },
      {
        q: "Which position should I pick?",
        a: "Center is hardest to crop out; corners are less intrusive. Raise opacity for stronger protection.",
      },
      {
        q: "Can I watermark a batch with different sizes?",
        a: "Yes — the watermark scales relative to each image's dimensions, so proportions stay consistent across the batch.",
      },
    ],
    relatedToolIds: ["compress-image", "resize-image", "crop-image", "jpg-to-pdf"],
  },

  {
    id: "background-remover",
    name: "Background Remover",
    description:
      "Erase photo backgrounds with an on-device AI model — transparent PNG cutouts, no upload, no account.",
    category: "image",
    processingMode: "browser",
    status: "live",
    keywords: ["remove background", "background eraser", "transparent png", "cutout image", "ai background removal"],
    icon: "wand-2",
    acceptedFormats: ["PNG", "JPG", "WebP"],
    maxFiles: 5,
    maxFileSizeMb: 20,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Drop photos of people, products or objects (up to 5).",
      "Click “Remove Background” — the AI model downloads once on first use.",
      "Download transparent PNG cutouts, subject intact.",
    ],
    faqs: [
      {
        q: "How good is the cutout?",
        a: "People, products and clear subjects come out very clean; hair, fur and glass are the hard cases. High-resolution inputs help.",
      },
      {
        q: "Where does the model come from?",
        a: "The ≈40 MB segmentation model downloads once from a CDN, then runs locally in WebAssembly — your images are never uploaded.",
      },
      {
        q: "Can I erase or restore parts afterwards?",
        a: "Not yet — for fine-tuning, take the PNG into “Crop Image” or an editor. Manual touch-up brushes are on the roadmap.",
      },
    ],
    relatedToolIds: ["resize-image", "compress-image", "watermark-image", "favicon-generator"],
  },

  {
    id: "heic-to-jpg",
    name: "HEIC to JPG",
    description:
      "Convert iPhone HEIC photos to universal JPG entirely on your device — multi-image HEICs become multi-page output.",
    category: "image",
    processingMode: "browser",
    status: "live",
    keywords: ["heic to jpg", "heic converter", "iphone photo converter", "heif to jpeg", "open heic"],
    icon: "arrow-left-right",
    acceptedFormats: ["HEIC", "HEIF"],
    maxFiles: 10,
    maxFileSizeMb: 50,
    supportsBatch: true,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Drop .heic or .heif files (iPhone photos welcome).",
      "Pick the JPG quality.",
      "Download universal JPGs — several images inside one file come out as separate JPGs.",
    ],
    faqs: [
      {
        q: "Why does every converter want to upload my HEICs?",
        a: "HEIC decoding traditionally needs a server — this tool ships a WebAssembly HEIF engine instead, so your photos stay on your device.",
      },
      {
        q: "What is HEIC?",
        a: "The High Efficiency Image Container — Apple's default photo format since iOS 11. Great compression, poor support outside Apple platforms.",
      },
      {
        q: "The engine is 3 MB — why?",
        a: "It's the full libheif codec compiled to WebAssembly, loaded once per browser session and cached after that.",
      },
    ],
    relatedToolIds: ["jpg-to-png", "png-to-jpg", "compress-image", "webp-converter"],
  },

  {
    id: "favicon-generator",
    name: "Favicon Generator",
    description:
      "Turn one image into a complete favicon pack — nine PNG sizes, a real multi-resolution .ico, and the HTML snippet.",
    category: "image",
    processingMode: "browser",
    status: "live",
    keywords: ["favicon generator", "create favicon", "ico converter", "website icon", "apple touch icon"],
    icon: "app-window",
    acceptedFormats: ["PNG", "JPG", "WebP"],
    maxFiles: 1,
    maxFileSizeMb: 30,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Upload a square-ish image (PNG or JPG).",
      "Click “Generate Favicon Pack” — sizes are center-cropped automatically.",
      "Download the ZIP: PNGs, favicon.ico and a ready-to-paste HTML snippet.",
    ],
    faqs: [
      {
        q: "Which sizes are generated?",
        a: "16, 32, 48, 64, 128, 180, 192, 256 and 512 px PNGs; the .ico packs 16/32/48. The 180 px file doubles as the apple-touch-icon.",
      },
      {
        q: "Does the .ico really work everywhere?",
        a: "Yes — it's a genuine multi-resolution ICO (PNG-compressed entries, the modern standard), verified by a parser in the unit tests.",
      },
      {
        q: "Non-square images?",
        a: "They're center-cropped to a square before resizing, so nothing gets stretched.",
      },
    ],
    relatedToolIds: ["resize-image", "compress-image", "background-remover", "crop-image"],
  },

  // --------------------------------------------------------------- Text
  {
    id: "word-counter",
    name: "Word Counter",
    description:
      "Count words, characters, sentences and paragraphs, with reading time and top keywords — updated live as you type.",
    category: "text",
    processingMode: "browser",
    status: "live",
    featured: true,
    keywords: ["character count", "letter count", "sentence counter", "reading time", "text statistics"],
    icon: "type",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote:
      "This tool runs entirely in your browser — your text is never sent anywhere.",
    howTo: [
      "Type or paste your text into the box.",
      "Watch the counts update live as you write.",
      "Review reading time and the most frequent keywords for a quick sense of focus.",
    ],
    faqs: [
      {
        q: "How is reading time calculated?",
        a: "At an average of 200 words per minute for reading and 130 for speaking — the same convention most editors use.",
      },
      {
        q: "What counts as a sentence or paragraph?",
        a: "Sentences end with ., ! or ?; paragraphs are separated by blank lines.",
      },
      {
        q: "Is there a text length limit?",
        a: "The counter comfortably handles book-length text (hundreds of thousands of words) in the browser.",
      },
    ],
    relatedToolIds: ["text-case-converter", "json-formatter", "qr-code-generator", "password-generator"],
  },
  {
    id: "text-case-converter",
    name: "Text Case Converter",
    description:
      "Switch text between UPPERCASE, lowercase, Title Case, Sentence case, camelCase, snake_case and more.",
    category: "text",
    processingMode: "browser",
    status: "live",
    keywords: ["uppercase", "lowercase", "capitalize", "title case", "camelcase", "snake case", "kebab case"],
    icon: "case-sensitive",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote:
      "This tool runs entirely in your browser — your text is never sent anywhere.",
    howTo: [
      "Paste your text into the input area.",
      "Click the case style you want — the converted text appears instantly.",
      "Copy the result or download it as a .txt file.",
    ],
    faqs: [
      {
        q: "What's the difference between Title Case and Sentence case?",
        a: "Title Case Capitalizes Every Word; sentence case only capitalizes the first letter of each sentence.",
      },
      {
        q: "When would I use snake_case or kebab-case?",
        a: "snake_case is common in programming variable names; kebab-case is used in URLs, CSS classes and file names.",
      },
      {
        q: "Will my line breaks be kept?",
        a: "Yes — line breaks are preserved in every conversion.",
      },
    ],
    relatedToolIds: ["word-counter", "json-formatter", "qr-code-generator", "password-generator"],
  },

  {
    id: "image-to-text",
    name: "Image to Text (OCR)",
    description:
      "Lift text out of screenshots and photos with on-device OCR — the engine loads once, then everything runs locally.",
    category: "text",
    processingMode: "browser",
    status: "live",
    keywords: ["ocr", "image to text", "screenshot text", "extract text from image", "photo to text"],
    icon: "scan-text",
    acceptedFormats: ["PNG", "JPG", "WebP", "BMP"],
    maxFiles: 10,
    maxFileSizeMb: 20,
    supportsBatch: true,
    privacyNote:
      "OCR runs locally in your browser. The engine itself downloads once from a CDN on first use — your images never leave your device.",
    howTo: [
      "Drop screenshots or photos containing text (up to 10).",
      "Click “Extract Text” — the first run fetches the OCR engine once.",
      "Read the preview and download .txt files per image.",
    ],
    faqs: [
      {
        q: "How accurate is it?",
        a: "Sharp screenshots and printed text come out nearly perfect; handwriting and skewed photos degrade quickly. Higher resolution and strong contrast help most.",
      },
      {
        q: "Can it read scanned PDFs?",
        a: "Indirectly — run the PDF through “PDF to JPG” first, then extract here. A direct PDF-OCR pipeline is on the roadmap.",
      },
      {
        q: "Which languages are supported?",
        a: "English ships now; more languages arrive with feedback.",
      },
    ],
    relatedToolIds: ["extract-pdf-text", "diff-checker", "pdf-to-jpg", "word-counter"],
  },
  {
    id: "diff-checker",
    name: "Diff Checker",
    description:
      "Compare two texts line by line with additions and removals highlighted — great for code, drafts and configs.",
    category: "text",
    processingMode: "browser",
    status: "live",
    keywords: ["text diff", "compare text", "difference checker", "file compare online", "line diff"],
    icon: "git-compare",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote: "This tool runs entirely in your browser — your text is never sent anywhere.",
    howTo: [
      "Paste the original on the left.",
      "Paste the changed version on the right.",
      "Read the highlighted differences — copy the changed version when you're done.",
    ],
    faqs: [
      {
        q: "Does it compare files directly?",
        a: "Paste their contents — the comparison is on text, which covers code, CSV, configs and prose alike.",
      },
      {
        q: "How big can the texts be?",
        a: "Documents of a few thousand lines compare instantly; very large files may need a moment.",
      },
      {
        q: "Is anything uploaded?",
        a: "No — the diff runs entirely in your browser tab.",
      },
    ],
    relatedToolIds: ["text-case-converter", "word-counter", "json-formatter", "qr-code-generator"],
  },

  // ---------------------------------------------------------- Developer
  {
    id: "json-formatter",
    name: "JSON Formatter",
    description:
      "Format, validate and minify JSON with precise error positions, indentation options and one-click copy.",
    category: "developer",
    processingMode: "browser",
    status: "live",
    keywords: ["json beautifier", "json validator", "json pretty print", "json minify", "json lint"],
    icon: "braces",
    acceptedFormats: ["JSON"],
    maxFiles: 1,
    maxFileSizeMb: 5,
    supportsBatch: false,
    privacyNote:
      "This tool runs entirely in your browser — your data is never sent anywhere.",
    howTo: [
      "Paste JSON into the editor.",
      "Click “Format” to pretty-print or “Minify” to strip whitespace.",
      "Invalid JSON shows the exact line and character of the first error.",
    ],
    faqs: [
      {
        q: "Which indentation can I choose?",
        a: "2 spaces, 4 spaces or a tab character — 2 spaces is the common default.",
      },
      {
        q: "How are errors reported?",
        a: "The parser stops at the first problem and the tool maps it to a line and character position so you can jump straight to it.",
      },
      {
        q: "Does it support JSON5 or comments?",
        a: "No — strict JSON per RFC 8259. Trailing commas and comments are reported as errors.",
      },
    ],
    relatedToolIds: ["qr-code-generator", "word-counter", "text-case-converter", "password-generator"],
  },
  {
    id: "qr-code-generator",
    name: "QR Code Generator",
    description:
      "Create QR codes for links, text or Wi-Fi strings with adjustable size, colors and error correction — download as PNG.",
    category: "developer",
    processingMode: "browser",
    status: "live",
    featured: true,
    keywords: ["qr code", "qrcode", "qr maker", "barcode", "qr png"],
    icon: "qr-code",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote:
      "This tool runs entirely in your browser — the codes are generated on your device.",
    howTo: [
      "Enter the text or URL the QR code should contain.",
      "Tune size, colors, quiet-zone margin and error-correction level.",
      "Download the PNG — it's ready for print or the web.",
    ],
    faqs: [
      {
        q: "Which error-correction level should I choose?",
        a: "M is the balanced default. Pick H if the code might get dirty or partially covered — it survives more damage but holds less data.",
      },
      {
        q: "How big can the content be?",
        a: "Up to roughly 2,900 characters depending on the correction level. Shorter content produces simpler, easier-to-scan codes.",
      },
      {
        q: "Do the codes expire?",
        a: "No. The content is encoded directly into the image — there is no service in the middle, so it works forever.",
      },
    ],
    relatedToolIds: ["json-formatter", "password-generator", "word-counter", "text-case-converter"],
  },

  {
    id: "jwt-decoder",
    name: "JWT Decoder",
    description:
      "Decode JSON Web Tokens — inspect the header, every claim, and see at a glance whether the token is expired.",
    category: "developer",
    processingMode: "browser",
    status: "live",
    keywords: ["decode jwt", "json web token", "inspect token", "jwt payload", "jwt expiry"],
    icon: "file-json",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Paste the JWT.",
      "Read the header, claims and lifetime notes.",
      "Copy any value you need — nothing is sent anywhere.",
    ],
    faqs: [
      {
        q: "Are signatures verified?",
        a: "No — this decodes and explains tokens. A valid-looking decode proves nothing about authenticity; verify with the issuing service.",
      },
      {
        q: "Why does it say the token is expired?",
        a: "The exp claim is a Unix timestamp; the tool converts it and compares to your clock. Expired tokens should be refreshed.",
      },
      {
        q: "What algorithms show up in the header?",
        a: "Typically HS256 or RS256, plus the token type. If alg is none, treat the token as insecure.",
      },
    ],
    relatedToolIds: ["json-formatter", "base64-tool", "timestamp-converter", "hash-generator"],
  },

  {
    id: "base64-tool",
    name: "Base64 Encode / Decode",
    description:
      "Convert text to Base64 and back, with URL-safe alphabet support — handles Unicode correctly.",
    category: "developer",
    processingMode: "browser",
    status: "live",
    keywords: ["base64 encode", "base64 decode", "base64url", "encode text", "decode base64"],
    icon: "binary",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Choose encode or decode.",
      "Paste your text or Base64.",
      "Copy the result — Unicode (emoji, other scripts) survives the round trip.",
    ],
    faqs: [
      {
        q: "What is the URL-safe variant?",
        a: "It swaps + and / for - and _ and drops padding, so the value can live in URLs and cookies without escaping.",
      },
      {
        q: "Why does my decoded text look broken?",
        a: "The input probably lost characters or padding — re-copy the whole Base64 string and try again.",
      },
      {
        q: "Can it decode files?",
        a: "For Base64 of files, use a dedicated file tool — this one is for text.",
      },
    ],
    relatedToolIds: ["jwt-decoder", "json-formatter", "hash-generator", "regex-tester"],
  },

  {
    id: "uuid-generator",
    name: "UUID Generator",
    description:
      "Generate random UUID v4 identifiers in bulk — uppercase, hyphen-free or braced, ready to copy.",
    category: "developer",
    processingMode: "browser",
    status: "live",
    keywords: ["uuid generator", "guid generator", "random uuid", "v4 uuid", "bulk uuid"],
    icon: "fingerprint",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Pick how many and the formatting.",
      "Click Generate.",
      "Copy one or the whole list.",
    ],
    faqs: [
      {
        q: "What is a v4 UUID?",
        a: "A 122-bit random identifier — collisions are practically impossible even at billions of IDs.",
      },
      {
        q: "Are these safe for secrets?",
        a: "They're unpredictable identifiers, but not secrets — anything security-critical should use a password or key, not a UUID you paste around.",
      },
      {
        q: "Where do the random values come from?",
        a: "crypto.randomUUID(), the browser's cryptographic generator — computed on your device.",
      },
    ],
    relatedToolIds: ["hash-generator", "password-generator", "jwt-decoder", "json-formatter"],
  },

  {
    id: "hash-generator",
    name: "Hash Generator",
    description:
      "Compute SHA-1, SHA-256, SHA-384 and SHA-512 of any text instantly, with one-click copy.",
    category: "developer",
    processingMode: "browser",
    status: "live",
    keywords: ["sha256 online", "hash text", "sha512", "sha1", "checksum text"],
    icon: "hash",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Type or paste text.",
      "All four digests update live.",
      "Copy the one you need.",
    ],
    faqs: [
      {
        q: "Which algorithm should I use?",
        a: "SHA-256 is today's default; SHA-512 for long-lived material. SHA-1 is compatibility-only and collision-broken.",
      },
      {
        q: "Why does the same text always hash the same?",
        a: "These digests are deterministic fingerprints — that's the point. Password storage needs salted slow hashes, which is a different job.",
      },
      {
        q: "Is this sent to a server?",
        a: "No — Web Crypto does the math in your tab.",
      },
    ],
    relatedToolIds: ["file-hash-verifier", "uuid-generator", "jwt-decoder", "password-generator"],
  },

  {
    id: "timestamp-converter",
    name: "Timestamp Converter",
    description:
      "Convert Unix timestamps to human dates and back — seconds or milliseconds, ISO, UTC, local and relative time.",
    category: "developer",
    processingMode: "browser",
    status: "live",
    keywords: ["unix timestamp", "epoch converter", "iso date", "timestamp to date", "date to unix"],
    icon: "clock",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Paste a Unix timestamp or a date on either side.",
      "The converter auto-detects seconds vs milliseconds.",
      "Read every format at once, updated live.",
    ],
    faqs: [
      {
        q: "Seconds or milliseconds — how does it know?",
        a: "10-digit values are treated as seconds, 13-digit as milliseconds. Ambiguity is rare in practice.",
      },
      {
        q: "Which timezone is shown?",
        a: "Local time follows your device; UTC and ISO 8601 are always shown alongside.",
      },
      {
        q: "Does it handle negative timestamps?",
        a: "Yes — dates before 1970 work on both sides.",
      },
    ],
    relatedToolIds: ["jwt-decoder", "json-formatter", "base64-tool", "regex-tester"],
  },

  {
    id: "color-toolkit",
    name: "Color Toolkit",
    description:
      "Convert colors between HEX, RGB and HSL and check WCAG contrast between any two — with pass/fail grades.",
    category: "developer",
    processingMode: "browser",
    status: "live",
    keywords: ["hex to rgb", "rgb to hsl", "color converter", "contrast checker", "wcag contrast"],
    icon: "palette",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Enter a hex color.",
      "Read the RGB and HSL equivalents.",
      "Add a second color to get the WCAG contrast ratio and grade.",
    ],
    faqs: [
      {
        q: "What do the grades mean?",
        a: "AA = 4.5:1 for normal text, AAA = 7:1, AA Large = 3:1 for big text or UI components. Fail means don't use it for text.",
      },
      {
        q: "Does it convert from RGB or HSL input?",
        a: "Input is hex; the outputs cover both other formats, and the HSL round-trip is verified in the unit tests.",
      },
      {
        q: "Why does contrast matter?",
        a: "Low contrast is the most common accessibility failure — this check catches it before users do.",
      },
    ],
    relatedToolIds: ["json-formatter", "regex-tester", "qr-code-generator", "uuid-generator"],
  },

  {
    id: "regex-tester",
    name: "Regex Tester",
    description:
      "Test regular expressions live against your text — matches highlighted inline, capture groups listed, errors explained.",
    category: "developer",
    processingMode: "browser",
    status: "live",
    keywords: ["regex tester", "regexp online", "test regex", "regex matcher", "regular expression test"],
    icon: "regex",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Type a pattern and pick flags.",
      "Paste the text to match against.",
      "Matches highlight live; groups appear below.",
    ],
    faqs: [
      {
        q: "Which regex flavor is this?",
        a: "JavaScript's (same as in browsers and Node). Most patterns port to PCRE, but not all.",
      },
      {
        q: "Why does my pattern match nothing?",
        a: "Check anchors and flags — ^ $ need the m flag per line on multiline text, and . needs s to cross lines.",
      },
      {
        q: "Is there a match limit?",
        a: "The first 500 matches highlight; the groups list shows the first 20.",
      },
    ],
    relatedToolIds: ["json-formatter", "base64-tool", "diff-checker", "color-toolkit"],
  },

  {
    id: "qr-scanner",
    name: "QR Code Scanner",
    description:
      "Read QR codes from an image or your camera — links, Wi-Fi keys, plain text — decoded entirely on your device.",
    category: "developer",
    processingMode: "browser",
    status: "live",
    keywords: ["qr scanner", "read qr code", "qr decoder", "scan qr from image", "camera qr"],
    icon: "scan-line",
    acceptedFormats: ["PNG", "JPG", "WebP", "GIF", "BMP"],
    maxFiles: 1,
    maxFileSizeMb: 20,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Drop an image containing a QR code — or click Scan with camera.",
      "Hold the code in view; camera scanning is automatic.",
      "Copy the decoded text or open the link.",
    ],
    faqs: [
      {
        q: "Which image formats work?",
        a: "PNG, JPG, WebP, GIF and BMP. Clear, well-lit codes decode best.",
      },
      {
        q: "Does the camera feed go anywhere?",
        a: "No — frames are decoded locally and never leave the page; the camera stops the moment a code is found.",
      },
      {
        q: "It can't read my code — now what?",
        a: "Try a tighter crop around the code, higher contrast, or re-screenshot at a larger size.",
      },
    ],
    relatedToolIds: ["qr-code-generator", "json-formatter", "base64-tool", "hash-generator"],
  },

  // ------------------------------------------------------------ Security
  {
    id: "password-generator",
    name: "Password Generator",
    description:
      "Generate strong random passwords with custom length and character sets, plus an entropy-based strength estimate.",
    category: "security",
    processingMode: "browser",
    status: "live",
    featured: true,
    keywords: ["random password", "secure password", "strong password", "passphrase", "password strength"],
    icon: "key-round",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote:
      "Passwords are generated locally with your browser's cryptographic random source. Nothing is transmitted or stored.",
    howTo: [
      "Choose a length and the character sets to include.",
      "Optionally exclude look-alike characters (I, l, 1, O, 0) for passwords you'll type by hand.",
      "Click “Generate” and copy — generate several at once if you need backups.",
    ],
    faqs: [
      {
        q: "What makes a password strong?",
        a: "Length and randomness. The strength meter shows entropy in bits — above 80 bits is considered very strong against offline attacks.",
      },
      {
        q: "Are these passwords safe to use?",
        a: "They're generated with crypto.getRandomValues, the browser's cryptographic random source, and never leave your device.",
      },
      {
        q: "Should I enable every character set?",
        a: "More sets add some entropy, but length matters far more. A 20-character password from three sets beats a 10-character one from four.",
      },
    ],
    relatedToolIds: ["qr-code-generator", "json-formatter", "word-counter", "text-case-converter"],
  },

  {
    id: "totp-generator",
    name: "TOTP Code Generator",
    description:
      "Turn a 2FA secret into live six-digit login codes — RFC 6238, computed locally with Web Crypto, nothing stored.",
    category: "security",
    processingMode: "browser",
    status: "live",
    keywords: ["totp", "2fa codes", "authenticator online", "one time password", "otp generator"],
    icon: "smartphone",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Paste the base32 secret a service shows under can't-scan / manual setup.",
      "The six-digit code appears with a countdown.",
      "Copy it into the login prompt — a next-code preview helps when you race the clock.",
    ],
    faqs: [
      {
        q: "Is this safe to use as my authenticator?",
        a: "Codes are correct RFC 6238 — but the secret isn't stored, so it's for occasional use. Your password manager or phone remains the everyday authenticator.",
      },
      {
        q: "Why does my code not work?",
        a: "Check for typos (spaces are fine) — and make sure your clock is accurate; the codes depend on exact time.",
      },
      {
        q: "What is base32?",
        a: "The A-Z and 2-7 alphabet services print for manual setup. QR codes carry the same secret inside otpauth:// URLs.",
      },
    ],
    relatedToolIds: ["password-generator", "password-auditor", "hash-generator", "file-hash-verifier"],
  },

  {
    id: "password-auditor",
    name: "Password Strength Auditor",
    description:
      "Check how strong a password really is — entropy, character classes, leaked-list hits and keyboard patterns — offline.",
    category: "security",
    processingMode: "browser",
    status: "live",
    keywords: ["password strength", "check password", "password audit", "how strong is my password", "weak password check"],
    icon: "shield-alert",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Type or paste the password (it never leaves the page).",
      "Watch the verdict, entropy and character classes update live.",
      "Fix the advice list until it reads strong — then store it in a manager.",
    ],
    faqs: [
      {
        q: "Is my password sent anywhere?",
        a: "No. All checks are offline heuristics in your tab — no network request happens.",
      },
      {
        q: "Why is a long passphrase rated well?",
        a: "Length with variety wins; the auditor measures real entropy over the characters used, not just classes.",
      },
      {
        q: "What counts as common?",
        a: "A curated list of the most-leaked passwords from public breach analyses — the ones cracking tools try first.",
      },
    ],
    relatedToolIds: ["password-generator", "totp-generator", "hash-generator", "qr-code-generator"],
  },

  {
    id: "file-hash-verifier",
    name: "File Hash Verifier",
    description:
      "Verify downloads against their published checksum — drop a file, paste the SHA-256, get a byte-for-byte verdict.",
    category: "security",
    processingMode: "browser",
    status: "live",
    keywords: ["verify checksum", "sha256 file", "file hash check", "sha256 verify", "download integrity"],
    icon: "file-check",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 500,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Drop the file you downloaded.",
      "Pick the algorithm the publisher used (usually SHA-256) and paste their digest.",
      "Match means the file is exactly what they shipped; mismatch means re-download.",
    ],
    faqs: [
      {
        q: "Where do I find the expected hash?",
        a: "Releases pages usually print it next to the download link — copy it exactly; colons and spaces are ignored.",
      },
      {
        q: "Why is MD5 not offered?",
        a: "Web Crypto dropped MD5 for good reason — it's broken. Publishers still on MD5 should move on.",
      },
      {
        q: "Can it hash huge files?",
        a: "Files up to 500 MB stream in chunks so the tab stays responsive.",
      },
    ],
    relatedToolIds: ["hash-generator", "password-auditor", "totp-generator", "qr-code-generator"],
  },

  {
    id: "screen-recorder",
    name: "Screen Recorder",
    description:
      "Record a tab, a window or your whole screen with optional narration — saved straight to your downloads, nothing uploaded.",
    category: "media",
    processingMode: "browser",
    status: "live",
    keywords: ["screen recorder", "record screen", "capture video", "screencast", "record tab"],
    icon: "video",
    acceptedFormats: [],
    maxFiles: 1,
    maxFileSizeMb: 1,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Click start and pick what to share in the browser's dialog.",
      "Narrate with your microphone if you like — the timer shows elapsed time.",
      "Stop and save the .webm, with an inline preview before you download.",
    ],
    faqs: [
      {
        q: "Which browsers support this?",
        a: "All modern Chromium and Firefox builds; Safari supports it from 13+. The share dialog decides what can be recorded.",
      },
      {
        q: "Why .webm and not .mp4?",
        a: "WebM is what browsers encode natively via MediaRecorder — no encoder downloads, no quality loss from re-wrapping. Convert if you need MP4.",
      },
      {
        q: "Where does the recording live?",
        a: "Only in this tab until you save it. Refresh and it's gone — there's no server and no temp storage.",
      },
    ],
    relatedToolIds: ["camera-scan-pdf", "qr-scanner", "image-to-text", "compress-image"],
  },
  {
    id: "audio-trimmer",
    name: "Audio Trimmer",
    description:
      "Record with your microphone or drop an audio file, trim to the good part on a real waveform, export clean WAV — all locally.",
    category: "media",
    processingMode: "browser",
    status: "live",
    keywords: ["audio trimmer", "cut audio", "trim mp3", "wav cutter", "voice recorder", "audio cutter"],
    icon: "video",
    acceptedFormats: ["WAV", "MP3", "OGG", "WEBM", "M4A", "FLAC"],
    maxFiles: 1,
    maxFileSizeMb: 200,
    supportsBatch: false,
    privacyNote: BROWSER_PRIVACY,
    howTo: [
      "Record with your microphone or drop an audio file (even a .webm screen recording — its audio is extracted).",
      "Drag the start/end sliders or click the waveform to set the part you keep.",
      "Preview the selection, then export it as a clean 16-bit WAV.",
    ],
    faqs: [
      {
        q: "Why does the export come out as WAV?",
        a: "WAV (16-bit PCM) is written directly from decoded samples — no encoder downloads, no quality loss from re-compression. Convert to MP3 if you need smaller files.",
      },
      {
        q: "Can it trim video?",
        a: "It extracts and trims the audio track of .webm recordings. Full video trimming needs a re-encode and is on the roadmap.",
      },
      {
        q: "How long can recordings be?",
        a: "Minutes are comfortable — decoding happens in memory, so very long files just take a moment to load.",
      },
    ],
    relatedToolIds: ["screen-recorder", "camera-scan-pdf", "qr-scanner", "compress-image"],
  },
];

// ---------------------------------------------------------------- helpers

const categoryById = new Map(categories.map((c) => [c.id, c]));
const toolById = new Map(tools.map((t) => [t.id, t]));

export function getCategory(id: string): Category | undefined {
  return categoryById.get(id as never);
}

export function getTool(id: string): ToolDefinition | undefined {
  return toolById.get(id);
}

export function toolRoute(tool: Pick<ToolDefinition, "id" | "category">): string {
  const category = getCategory(tool.category);
  return `/${category?.slug ?? "tools"}/${tool.id}`;
}

export function liveTools(): ToolWithRoute[] {
  return tools
    .filter((t) => t.status === "live")
    .map((t) => ({
      ...t,
      route: toolRoute(t),
      categorySlug: getCategory(t.category)!.slug,
      categoryName: getCategory(t.category)!.name,
    }));
}

export function featuredTools(): ToolWithRoute[] {
  return liveTools().filter((t) => t.featured);
}

export function toolsInCategory(categoryId: string): ToolWithRoute[] {
  return liveTools().filter((t) => t.category === categoryId);
}

/** Categories that expose at least one live tool (drives navigation). */
export function activeCategories(): Array<Category & { toolCount: number }> {
  return categories
    .map((c) => ({ ...c, toolCount: toolsInCategory(c.id).length }))
    .filter((c) => c.toolCount > 0);
}

export function relatedTools(tool: ToolDefinition): ToolWithRoute[] {
  const related = tool.relatedToolIds
    .map((id) => liveTools().find((t) => t.id === id))
    .filter((t): t is ToolWithRoute => Boolean(t));
  if (related.length >= 3) return related;
  // Backfill from the same category so the section is never sparse.
  const backfill = toolsInCategory(tool.category).filter(
    (t) => t.id !== tool.id && !related.some((r) => r.id === t.id),
  );
  return [...related, ...backfill].slice(0, 4);
}
