import type { SupplierMessageStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface SupplierMessageWriteData {
  restaurantId: string;
  supplierId: string;
  rfqId: string | null;
  toEmail: string;
  subject: string;
  body: string;
  status: SupplierMessageStatus;
  providerId: string | null;
  error: string | null;
  sentById: string | null;
}

export const createSupplierMessage = (data: SupplierMessageWriteData) =>
  prisma.supplierMessage.create({ data, select: { id: true } });

export const findSupplierMessages = (
  restaurantId: string,
  filter: { supplierId?: string; take?: number } = {},
) =>
  prisma.supplierMessage.findMany({
    where: {
      restaurantId,
      ...(filter.supplierId ? { supplierId: filter.supplierId } : {}),
    },
    select: {
      id: true,
      supplierId: true,
      toEmail: true,
      subject: true,
      status: true,
      error: true,
      createdAt: true,
      supplier: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: filter.take ?? 20,
  });

export type SupplierMessageRow = Awaited<ReturnType<typeof findSupplierMessages>>[number];
