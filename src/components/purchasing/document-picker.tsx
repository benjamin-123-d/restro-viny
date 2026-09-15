"use client";

import { CameraIcon, FileTextIcon, PaperclipIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES, checkDocumentFile } from "@/lib/supplier-documents";
import { humanError } from "@/lib/error-messages";
import { cn } from "@/lib/utils";

export type PickedSource = "FILE" | "PHOTO";

export interface PickedDocument {
  readonly file: File;
  readonly source: PickedSource;
}

const sizeLabel = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} Ko`
    : `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;

/**
 * Where a supplier's document comes in: pick the PDF saved from an email, drop
 * it here, or — on a phone — take a photo of the paper straight away.
 */
export function DocumentPicker({
  value,
  onChange,
  error,
}: {
  readonly value: PickedDocument | null;
  readonly onChange: (value: PickedDocument | null) => void;
  readonly error?: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Browsers cannot display HEIC, so those get the file card instead.
  const previewable = Boolean(value && value.file.type.startsWith("image/") && !value.file.type.includes("hei"));
  const preview = useMemo(
    () => (value && previewable ? URL.createObjectURL(value.file) : null),
    [value, previewable],
  );
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const take = (file: File | undefined, source: PickedSource) => {
    if (!file) return;
    const issue = checkDocumentFile(file);
    if (issue) {
      setProblem(humanError(issue));
      return;
    }
    setProblem(null);
    onChange({ file, source });
  };

  const shown = problem ?? error;

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileInput}
        type="file"
        accept={DOCUMENT_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => take(e.target.files?.[0], "FILE")}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => take(e.target.files?.[0], "PHOTO")}
      />

      {value ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local object URL, never optimisable
            <img src={preview} alt="Aperçu du document" className="max-h-80 w-full object-contain bg-muted" />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2 bg-muted text-muted-foreground">
              <FileTextIcon className="size-10" aria-hidden />
              <span className="text-xs">{value.file.type === "application/pdf" ? "Document PDF" : "Photo"}</span>
            </div>
          )}
          <div className="flex items-center gap-2 border-t px-3 py-2 text-sm">
            <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate" title={value.file.name}>
              {value.file.name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{sizeLabel(value.file.size)}</span>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                if (fileInput.current) fileInput.current.value = "";
                if (cameraInput.current) cameraInput.current.value = "";
              }}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Retirer le document"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            take(e.dataTransfer.files?.[0], "FILE");
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
            dragging ? "border-foreground bg-muted" : "border-border",
          )}
        >
          <PaperclipIcon className="size-7 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Glissez ici le PDF reçu par e-mail, ou choisissez :
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <FileTextIcon className="size-4" aria-hidden />
              Importer un fichier
            </button>
            <button
              type="button"
              onClick={() => cameraInput.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              <CameraIcon className="size-4" aria-hidden />
              Prendre une photo
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            PDF, JPEG, PNG ou HEIC — {Math.round(DOCUMENT_MAX_BYTES / (1024 * 1024))} Mo maximum.
          </p>
        </div>
      )}
      {shown ? <p className="text-xs text-destructive">{shown}</p> : null}
    </div>
  );
}
