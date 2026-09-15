import Link from "next/link";
import { notFound } from "next/navigation";

import {
  InvoiceDocument,
  INVOICE_COPIES,
  isInvoiceCopy,
  type InvoiceCopy,
} from "@/components/selling/invoice-document";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { getCustomer } from "@/services/customer.service";
import { getSalesInvoice } from "@/services/sales.document.service";
import { findRestaurantById } from "@/repositories/restaurant.repository";

/**
 * One invoice, rendered as the document it is. `?copy=` switches between the
 * original and its duplicates without changing a single figure.
 */
export default async function SalesInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copy?: string }>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) notFound();

  const { id } = await params;
  const { copy: copyParam } = await searchParams;
  const copy: InvoiceCopy = isInvoiceCopy(copyParam) ? copyParam : "original";

  const invoice = await getSalesInvoice(ctx, id).catch(() => null);
  if (!invoice) notFound();

  const [restaurant, customer] = await Promise.all([
    findRestaurantById(ctx.restaurantId),
    getCustomer(ctx, invoice.customerId).catch(() => null),
  ]);

  const customerAddress = [
    customer?.addressLine1,
    customer?.addressLine2,
    customer?.city,
    customer?.phone,
    customer?.taxId ? `N° TVA ${customer.taxId}` : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* Copy switcher — hidden on paper, since the sheet says which copy it is. */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link
          href="/dashboard/selling/invoices"
          className="rounded-md border px-3 py-1.5 text-sm font-medium text-zinc-700"
        >
          ← All invoices
        </Link>
        <span className="ml-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Exemplaire
        </span>
        {INVOICE_COPIES.map((option) => (
          <Link
            key={option.key}
            href={`/dashboard/selling/invoices/${invoice.id}?copy=${option.key}`}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              option.key === copy
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "text-zinc-700 hover:border-zinc-500"
            }`}
          >
            {option.label}
          </Link>
        ))}
        <span className="text-xs text-zinc-500">
          Imprimez depuis le navigateur (Ctrl+P) : la mention de l'exemplaire est imprimée avec.
        </span>
      </div>

      <div className="rounded-lg border bg-white shadow-sm print:border-0 print:shadow-none">
        <InvoiceDocument
          invoice={invoice}
          copy={copy}
          customerAddress={customerAddress}
          issuer={{
            name: restaurant?.name ?? "Restaurant",
            legalName: restaurant?.legalName ?? null,
            addressLine1: restaurant?.addressLine1 ?? null,
            city: restaurant?.city ?? null,
            phone: restaurant?.phone ?? null,
            email: restaurant?.email ?? null,
            taxId: restaurant?.gstin ?? null,
            footerNote: restaurant?.invoiceFooterNote ?? null,
          }}
        />
      </div>
    </div>
  );
}
