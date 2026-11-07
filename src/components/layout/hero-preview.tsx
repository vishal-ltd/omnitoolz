import { ToolIcon } from "@/components/icons";
import { IconBox } from "@/components/ui/icon-box";

const QUEUED = [
  { name: "invoice-march.pdf", size: "720 KB" },
  { name: "invoice-april.pdf", size: "712 KB" },
];

/**
 * The hero used to promise "every tool, one place" over empty dither. This shows
 * the promise instead: a real merge queue, drawn in code from the same tokens as
 * the tool itself. Static on purpose — it is a picture of the product, not a
 * second set of controls to tab through.
 */
export function HeroPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of Merge PDF: two invoices queued, 1.4 MB total, nothing uploaded, ready to merge"
      className="mx-auto mt-10 max-w-2xl border-[3px] border-edge bg-card p-4 text-left shadow-[6px_6px_0_0_var(--color-shadow)]"
    >
      <div className="flex items-center gap-3 border-b-[3px] border-line pb-3">
        <IconBox className="size-8">
          <ToolIcon name="files" className="size-4" />
        </IconBox>
        <span className="font-display text-display-xs uppercase text-ink">Merge PDF</span>
        <span className="ml-auto font-body text-base text-ink-soft tabular-nums">2 files · 1.4 MB</span>
      </div>

      <ul className="mt-1 divide-y-2 divide-line">
        {QUEUED.map((file, index) => (
          <li key={file.name} className="flex items-center gap-3 py-2.5">
            <span className="font-body text-base text-ink-soft tabular-nums">{index + 1}.</span>
            <ToolIcon name="file-text" className="size-4 shrink-0 text-brand" />
            <span className="min-w-0 flex-1 truncate font-body text-lg text-ink">{file.name}</span>
            <span className="shrink-0 font-body text-base text-ink-soft tabular-nums">{file.size}</span>
          </li>
        ))}
      </ul>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t-[3px] border-line pt-3">
        <span className="border-[3px] border-edge bg-ok-soft px-1.5 font-display text-display-xs text-ink">
          0 B uploaded
        </span>
        <span className="border-[3px] border-edge bg-brand px-4 py-2 font-display text-display-xs uppercase text-on-brand shadow-[3px_3px_0_0_var(--color-shadow)]">
          Merge PDFs
        </span>
      </div>
    </div>
  );
}
