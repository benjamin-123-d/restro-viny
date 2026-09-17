"use client";

import { DownloadIcon, ExternalLinkIcon, RotateCwIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * The left half of the desk: the piece itself, big enough to read.
 *
 * A PDF is handed to the browser's own viewer — it already has pages, zoom and
 * search, and reimplementing those on top of pdf.js would be a week of work to
 * arrive back where we started. A photograph has none of that, so it gets its
 * own zoom and rotation: a receipt scanned sideways is otherwise unreadable.
 */
export function PieceViewer({
  documentId,
  fileName,
  mimeType,
  selfJustified,
}: {
  readonly documentId: string | null;
  readonly fileName: string | null;
  readonly mimeType: string | null;
  /** A customer invoice the restaurant issued is its own proof. */
  readonly selfJustified?: boolean;
}) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  if (!documentId) {
    return (
      <div className="flex h-full min-h-96 items-center justify-center rounded-lg border border-dashed p-8">
        <p className="text-muted-foreground max-w-xs text-center text-sm">
          {selfJustified
            ? "Facture émise par le restaurant : elle est elle-même le justificatif. Rien à joindre."
            : "Aucun justificatif joint à cette pièce. Une écriture ne se comptabilise pas sans la facture qui la prouve."}
        </p>
      </div>
    );
  }

  const source = `/api/purchasing/documents/${documentId}`;
  const isImage = (mimeType ?? "").startsWith("image/");

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground min-w-0 truncate text-xs" title={fileName ?? undefined}>
          {fileName}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {isImage ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom((current) => Math.max(25, current - 25))}
                aria-label="Réduire"
              >
                −
              </Button>
              <span className="w-12 text-center text-xs tabular-nums">{zoom} %</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom((current) => Math.min(400, current + 25))}
                aria-label="Agrandir"
              >
                +
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setRotation((current) => (current + 90) % 360)}
                aria-label="Pivoter"
              >
                <RotateCwIcon className="size-4" />
              </Button>
            </>
          ) : null}
          <Button variant="outline" size="icon" render={<a href={source} target="_blank" rel="noreferrer" aria-label="Ouvrir dans un onglet" />}>
            <ExternalLinkIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            render={<a href={`${source}?download=1`} aria-label="Télécharger" />}
          >
            <DownloadIcon className="size-4" />
          </Button>
        </span>
      </div>

      <div className="bg-muted/40 min-h-96 flex-1 overflow-auto rounded-lg border p-2">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={source}
            alt={fileName ?? "Justificatif"}
            style={{ width: `${zoom}%`, transform: `rotate(${rotation}deg)` }}
            className="mx-auto origin-center transition-transform"
          />
        ) : (
          <iframe src={source} title={fileName ?? "Justificatif"} className="h-[70vh] min-h-96 w-full rounded" />
        )}
      </div>
    </div>
  );
}
