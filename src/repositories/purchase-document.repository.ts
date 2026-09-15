import type {
  PurchaseDocumentKind,
  PurchaseDocumentSource,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Everything but the file bytes, for lists and detail pages. */
export const DOCUMENT_META_SELECT = {
  id: true,
  kind: true,
  source: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
} as const;

export interface PurchaseDocumentMeta {
  id: string;
  kind: PurchaseDocumentKind;
  source: PurchaseDocumentSource;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface PurchaseDocumentWriteData {
  restaurantId: string;
  kind: PurchaseDocumentKind;
  source: PurchaseDocumentSource;
  fileName: string;
  mimeType: string;
  content: Buffer;
  quotationId: string | null;
  invoiceId: string | null;
  uploadedById: string | null;
}

export const createPurchaseDocument = (
  data: PurchaseDocumentWriteData,
): Promise<PurchaseDocumentMeta> =>
  prisma.purchaseDocument.create({
    data: {
      restaurantId: data.restaurantId,
      kind: data.kind,
      source: data.source,
      fileName: data.fileName,
      mimeType: data.mimeType,
      sizeBytes: data.content.byteLength,
      content: new Uint8Array(data.content),
      quotationId: data.quotationId,
      invoiceId: data.invoiceId,
      uploadedById: data.uploadedById,
    },
    select: DOCUMENT_META_SELECT,
  });

export const findPurchaseDocumentById = (id: string) =>
  prisma.purchaseDocument.findUnique({ where: { id } });

export const findPurchaseDocumentMetaById = (id: string) =>
  prisma.purchaseDocument.findUnique({
    where: { id },
    select: { ...DOCUMENT_META_SELECT, restaurantId: true, quotationId: true, invoiceId: true },
  });

export const deletePurchaseDocument = (id: string): Promise<void> =>
  prisma.purchaseDocument.delete({ where: { id } }).then(() => undefined);
