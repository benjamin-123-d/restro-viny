import type { PurchaseDocumentMeta } from "@/repositories/purchase-document.repository";
import type { PurchaseDocumentDTO } from "@/types/purchasing";

/** Where a stored supplier document is served, behind the manager's session. */
export const documentUrl = (id: string): string => `/api/purchasing/documents/${id}`;

export const toDocumentDTO = (d: PurchaseDocumentMeta): PurchaseDocumentDTO => ({
  id: d.id,
  kind: d.kind,
  source: d.source,
  fileName: d.fileName,
  mimeType: d.mimeType,
  sizeBytes: d.sizeBytes,
  createdAt: d.createdAt.toISOString(),
  isImage: d.mimeType.startsWith("image/"),
  url: documentUrl(d.id),
});
