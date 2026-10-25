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
import { Checkbox, Field, TextInput } from "@/components/ui/form";
import { bytesToBlob, suffixedName, type ResultFile } from "@/lib/utils";
import { encryptAndSave, loadPdfForEncryption } from "./pdf-secure";

export default function ProtectPdfTool() {
  const queue = useFileQueue({ accept: ["pdf"], multiple: false, maxFiles: 1, maxSizeMb: 100 });
  const { state, start, reset } = useJob();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(true);
  const [allowModifying, setAllowModifying] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  useHandoffFile(queue.addFiles, queue.files.length > 0);

  const file = queue.files[0];

  async function protect() {
    const source = file!;
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    const chosen = password;
    await start(async ({ report }) => {
      report("Encrypting with AES-256…", 0.6);
      const doc = await loadPdfForEncryption(source);
      const bytes = await encryptAndSave(doc, {
        userPassword: chosen,
        ownerPassword: chosen,
        allowPrinting,
        allowCopying,
        allowModifying,
      });
      const result: ResultFile = {
        name: suffixedName(source.name, "-protected"),
        blob: bytesToBlob(bytes, "application/pdf"),
      };
      return [result];
    }, "Encrypting document…");
  }

  const tooShort = password.length > 0 && password.length < 4;

  return (
    <ToolWidget>
      {state.phase === "done" ? (
        <Results
          results={state.results}
          elapsedMs={state.elapsedMs}
          note="AES-256 — store the password safely; there is no recovery."
          onReset={() => {
            queue.clear();
            setPassword("");
            setConfirm("");
            reset();
          }}
        />
      ) : state.phase === "running" ? (
        <JobProgress state={state} />
      ) : (
        <div className="space-y-4">
          <FileDropZone accept={["pdf"]} multiple={false} maxFiles={1} maxSizeMb={100} onFiles={queue.addFiles} existingCount={queue.files.length} />
          <FileList files={queue.files} onRemove={queue.removeAt} />

          {file && (
            <OptionsPanel title="Password">
              <Field label="Open password" hint="Needed to open the file — 4+ characters">
                <TextInput
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Choose a strong password"
                  aria-label="PDF open password"
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm password">
                <TextInput
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Repeat the password"
                  aria-label="Confirm PDF password"
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Reader permissions" hint="What someone with the password may do" className="sm:col-span-2">
                <div className="space-y-1.5">
                  <Checkbox checked={allowPrinting} onChange={setAllowPrinting} label="Allow printing" />
                  <Checkbox checked={allowCopying} onChange={setAllowCopying} label="Allow copying text" />
                  <Checkbox checked={allowModifying} onChange={setAllowModifying} label="Allow modifying the document" />
                </div>
              </Field>
              {mismatch && (
                <p className="text-sm text-err sm:col-span-2">The two passwords don&apos;t match.</p>
              )}
              {tooShort && (
                <p className="text-sm text-warn sm:col-span-2">That password is very short — anyone could guess it.</p>
              )}
            </OptionsPanel>
          )}

          {state.phase === "error" && <JobError message={state.error ?? ""} />}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">Encryption runs locally — the password never leaves this tab.</p>
            <Button
              size="lg"
              disabled={!file || password.length < 4 || password !== confirm}
              onClick={protect}
            >
              Protect PDF
            </Button>
          </div>
        </div>
      )}
    </ToolWidget>
  );
}
