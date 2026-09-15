import type {
  Prisma,
  RequestForQuotation,
  RfqStatus,
  SupplierQuotation,
  SupplierQuotationStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { claimDocumentNumber } from "@/repositories/document-sequence.repository";

// ------------------------------------------------------------------- rfq ---

export interface RfqLineWriteData {
  stockItemId: string;
  description: string | null;
  quantity: number;
  requiredBy: Date | null;
  sortOrder: number;
}

export interface RfqWriteData {
  transactionDate: Date;
  requiredBy: Date | null;
  message: string | null;
  termsText: string | null;
}

const rfqDetail = {
  items: {
    orderBy: { sortOrder: "asc" },
    include: { stockItem: { select: { id: true, name: true, unit: true } } },
  },
  suppliers: {
    include: { supplier: { select: { id: true, name: true } } },
  },
  quotations: {
    select: { id: true, supplierId: true, status: true },
  },
} satisfies Prisma.RequestForQuotationInclude;

export type RfqWithDetail = Prisma.RequestForQuotationGetPayload<{
  include: typeof rfqDetail;
}>;

const rfqListSelect = {
  id: true,
  number: true,
  status: true,
  transactionDate: true,
  requiredBy: true,
  _count: { select: { items: true, suppliers: true, quotations: true } },
} satisfies Prisma.RequestForQuotationSelect;

export type RfqListRow = Prisma.RequestForQuotationGetPayload<{
  select: typeof rfqListSelect;
}>;

export const createRfq = (
  restaurantId: string,
  createdById: string,
  data: RfqWriteData,
  lines: readonly RfqLineWriteData[],
  supplierIds: readonly string[],
): Promise<RfqWithDetail> =>
  prisma.$transaction(async (tx) => {
    const number = await claimDocumentNumber(restaurantId, "RFQ", tx);
    return tx.requestForQuotation.create({
      data: {
        restaurantId,
        createdById,
        number,
        ...data,
        items: { create: lines.map((line) => ({ ...line })) },
        suppliers: { create: supplierIds.map((supplierId) => ({ supplierId })) },
      },
      include: rfqDetail,
    });
  });

export const updateRfq = (
  id: string,
  data: RfqWriteData,
  lines: readonly RfqLineWriteData[],
  supplierIds: readonly string[],
): Promise<RfqWithDetail> =>
  prisma.$transaction(async (tx) => {
    await tx.rfqItem.deleteMany({ where: { rfqId: id } });
    await tx.rfqSupplier.deleteMany({ where: { rfqId: id } });
    return tx.requestForQuotation.update({
      where: { id },
      data: {
        ...data,
        items: { create: lines.map((line) => ({ ...line })) },
        suppliers: { create: supplierIds.map((supplierId) => ({ supplierId })) },
      },
      include: rfqDetail,
    });
  });

export const setRfqStatus = (
  id: string,
  status: RfqStatus,
  stamps: { submittedAt?: Date; cancelledAt?: Date } = {},
): Promise<RequestForQuotation> =>
  prisma.requestForQuotation.update({
    where: { id },
    data: { status, ...stamps },
  });

export const findRfqById = (id: string): Promise<RfqWithDetail | null> =>
  prisma.requestForQuotation.findUnique({ where: { id }, include: rfqDetail });

export const findRfqs = (
  restaurantId: string,
  filter: { status?: readonly RfqStatus[]; take?: number } = {},
): Promise<RfqListRow[]> =>
  prisma.requestForQuotation.findMany({
    where: {
      restaurantId,
      ...(filter.status ? { status: { in: [...filter.status] } } : {}),
    },
    select: rfqListSelect,
    orderBy: [{ transactionDate: "desc" }, { number: "desc" }],
    ...(filter.take ? { take: filter.take } : {}),
  });

export const deleteDraftRfq = (id: string): Promise<void> =>
  prisma.requestForQuotation.delete({ where: { id } }).then(() => undefined);

export const markRfqSupplierSent = (
  rfqId: string,
  supplierId: string,
): Promise<unknown> =>
  prisma.rfqSupplier.update({
    where: { rfqId_supplierId: { rfqId, supplierId } },
    data: { emailSentAt: new Date() },
  });

// ------------------------------------------------------- supplier quotation ---

export interface QuotationLineWriteData {
  stockItemId: string;
  rfqItemId: string | null;
  description: string | null;
  quantity: number;
  rate: number;
  discountPercent: number | null;
  taxRate: number;
  amount: number;
  leadTimeDays: number | null;
  sortOrder: number;
}

export interface QuotationWriteData {
  supplierReference?: string | null;
  summaryOnly?: boolean;
  supplierId: string;
  rfqId: string | null;
  transactionDate: Date;
  validUntil: Date | null;
  currency: string | null;
  subtotal: number;
  discountAmount: number;
  taxTotal: number;
  grandTotal: number;
  notes: string | null;
  termsText: string | null;
}

const quotationDetail = {
  documents: {
    select: { id: true, kind: true, source: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  },
  supplier: { select: { id: true, name: true } },
  rfq: { select: { id: true, number: true } },
  items: {
    orderBy: { sortOrder: "asc" },
    include: { stockItem: { select: { id: true, name: true, unit: true } } },
  },
} satisfies Prisma.SupplierQuotationInclude;

export type QuotationWithDetail = Prisma.SupplierQuotationGetPayload<{
  include: typeof quotationDetail;
}>;

const quotationListSelect = {
  id: true,
  number: true,
  status: true,
  transactionDate: true,
  validUntil: true,
  grandTotal: true,
  summaryOnly: true,
  rfqId: true,
  supplier: { select: { name: true } },
  _count: { select: { documents: true } },
} satisfies Prisma.SupplierQuotationSelect;

export type QuotationListRow = Prisma.SupplierQuotationGetPayload<{
  select: typeof quotationListSelect;
}>;

export const createQuotation = (
  restaurantId: string,
  createdById: string,
  data: QuotationWriteData,
  lines: readonly QuotationLineWriteData[],
): Promise<QuotationWithDetail> =>
  prisma.$transaction(async (tx) => {
    const number = await claimDocumentNumber(restaurantId, "SQTN", tx);
    return tx.supplierQuotation.create({
      data: {
        restaurantId,
        createdById,
        number,
        ...data,
        items: { create: lines.map((line) => ({ ...line })) },
      },
      include: quotationDetail,
    });
  });

export const updateQuotation = (
  id: string,
  data: QuotationWriteData,
  lines: readonly QuotationLineWriteData[],
): Promise<QuotationWithDetail> =>
  prisma.$transaction(async (tx) => {
    await tx.supplierQuotationItem.deleteMany({ where: { quotationId: id } });
    return tx.supplierQuotation.update({
      where: { id },
      data: { ...data, items: { create: lines.map((line) => ({ ...line })) } },
      include: quotationDetail,
    });
  });

export const setQuotationStatus = (
  id: string,
  status: SupplierQuotationStatus,
  stamps: { submittedAt?: Date; cancelledAt?: Date } = {},
): Promise<SupplierQuotation> =>
  prisma.supplierQuotation.update({ where: { id }, data: { status, ...stamps } });

export const findQuotationById = (
  id: string,
): Promise<QuotationWithDetail | null> =>
  prisma.supplierQuotation.findUnique({
    where: { id },
    include: quotationDetail,
  });

export const findQuotations = (
  restaurantId: string,
  filter: {
    status?: readonly SupplierQuotationStatus[];
    supplierId?: string;
    rfqId?: string;
    take?: number;
  } = {},
): Promise<QuotationListRow[]> =>
  prisma.supplierQuotation.findMany({
    where: {
      restaurantId,
      ...(filter.status ? { status: { in: [...filter.status] } } : {}),
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
      ...(filter.rfqId ? { rfqId: filter.rfqId } : {}),
    },
    select: quotationListSelect,
    orderBy: [{ transactionDate: "desc" }, { number: "desc" }],
    ...(filter.take ? { take: filter.take } : {}),
  });

export const deleteDraftQuotation = (id: string): Promise<void> =>
  prisma.supplierQuotation.delete({ where: { id } }).then(() => undefined);

/** Every submitted quote against one RFQ, for the side-by-side comparison. */
export const findQuotationsForRfq = (
  rfqId: string,
): Promise<QuotationWithDetail[]> =>
  prisma.supplierQuotation.findMany({
    where: { rfqId, status: { notIn: ["DRAFT", "CANCELLED"] } },
    include: quotationDetail,
    orderBy: { grandTotal: "asc" },
  });
