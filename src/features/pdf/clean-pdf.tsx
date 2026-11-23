"use client";

import { useState } from "react";
import { FileDropZone } from "@/components/tools/file-dropzone";
import { FileList } from "@/components/tools/file-list";
import { useFileQueue } from "@/components/tools/file-queue";
import { useHandoffFile } from "@/components/tools/use-handoff";
import { JobError, JobProgress, OptionsPanel, ToolWidget } from "@/components/tools/job-ui";
import { Results } from "@/components/tools/results";
import { useJob } from "@/components/tools/use-job";
import { Button } from "@/components/ui/button";
import { Checkbox, Field } from "@/components/ui/form";
import { baseName, suffixedName, type ResultFile } from "@/lib/utils";
import { loadPdf, savePdf, yieldToUi } from "./pdf-core";

export default function CleanPdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: true, maxFiles: 20, maxSizeMb: 100 });
  const { state, start, reset, retry } = useJob();
  const [stripMetadata, setStripMetadata] = useState(true);
  const [removeAnnotations, setRemoveAnnotations] = useState(true);
  const [removeOutline, setRemoveOutline] = useState(false);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  async function clean() {
    const sources = queue.files;
    await start(async ({ report }) => {
      const { PDFName, PDFArray, PDFDict, PDFRef } = await import("pdf-lib");
      const results: ResultFile[] = [];
      for (const [index, source] of sources.entries()) {
        report(`Cleaning “${source.name}”…`, (index + 0.5) / sources.length);
        const doc = await loadPdf(source);
        if (stripMetadata) {
          doc.setTitle("");
          doc.setAuthor("");
          doc.setSubject("");
          doc.setKeywords([]);
          doc.setCreator("");
          doc.setProducer("");
          // Dates live in the Info dictionary, not the six string fields.
          const info = doc.context.lookup(doc.context.trailerInfo.Info);
          if (info instanceof PDFDict) {
            info.delete(PDFName.of("CreationDate"));
            info.delete(PDFName.of("ModDate"));
          }
          // XMP packet: the catalog's /Metadata stream carries the same data.
          const metaRef = doc.catalog.get(PDFName.of("Metadata"));
          if (metaRef) {
            doc.catalog.delete(PDFName.of("Metadata"));
            if (metaRef instanceof PDFRef) doc.context.delete(metaRef);
          }
        }
        if (removeAnnotations) {
          // Only comment/markup annotations go. Links and form-field widgets
          // are content, not leftovers — wiping them broke forms and hyperlinks.
          const dictOf = (entry: import("pdf-lib").PDFObject): import("pdf-lib").PDFDict | null => {
            const resolved = entry instanceof PDFRef ? doc.context.lookup(entry) : entry;
            return resolved instanceof PDFDict ? resolved : null;
          };
          const subtypeOf = (entry: import("pdf-lib").PDFObject): string => {
            const subtype = dictOf(entry)?.get(PDFName.of("Subtype"));
            return subtype instanceof PDFName ? subtype.toString() : "";
          };
          for (const page of doc.getPages()) {
            const annots = doc.context.lookup(page.node.get(PDFName.of("Annots")));
            if (!(annots instanceof PDFArray)) continue;
            const entries = annots.asArray();
            const kept = new Set(
              entries.filter((entry) => {
                const name = subtypeOf(entry);
                return name === "/Link" || name === "/Widget";
              }),
            );
            // A popup survives only while its parent annotation survives.
            const surviving = entries.filter((entry) => {
              if (kept.has(entry)) return true;
              if (subtypeOf(entry) !== "/Popup") return false;
              const parent = dictOf(entry)?.get(PDFName.of("Parent"));
              return parent !== undefined && kept.has(parent);
            });
            page.node.set(PDFName.of("Annots"), doc.context.obj(surviving));
          }
        }
        if (removeOutline) {
          doc.catalog.delete(PDFName.of("Outlines"));
        }
        await yieldToUi();
        results.push(await savePdf(doc, suffixedName(source.name, "-clean")));
      }
      return results;
    }, "Cleaning documents…");
  }

  const anyCleaner = stripMetadata || removeAnnotations || removeOutline;

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          zipBaseName={baseName(queue.files[0]?.name ?? "pdfs")}
          note="Hidden details removed — page content untouched."
          onReset={() => {
            queue.clear();
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple maxFiles={20} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} onUndo={queue.undoRemove} undoLabel={queue.lastRemoved} />

          {queue.files.length > 0 && (
            <OptionsPanel title="What to remove">
              <Field label="Hidden metadata" hint="Title, author, subject, keywords, creator, producer, dates">
                <Checkbox checked={stripMetadata} onChange={setStripMetadata} label="Strip document metadata" />
              </Field>
              <Field label="Comments" hint="Highlights, sticky notes, drawn annotations — links and form fields stay">
                <Checkbox checked={removeAnnotations} onChange={setRemoveAnnotations} label="Delete comments & annotations" />
              </Field>
              <Field label="Bookmarks" hint="The sidebar outline">
                <Checkbox checked={removeOutline} onChange={setRemoveOutline} label="Remove bookmark outline" />
              </Field>
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError error={state.error} detail={state.errorDetail} kind={state.errorKind} onRetry={retry} onDismiss={reset} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Share documents without the hidden leftovers.</p>
            <Button
              size="lg"
              disabled={queue.files.length === 0 || !anyCleaner}
              onClick={clean}
            >
              Clean PDF
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
