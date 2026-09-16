import { formatCurrency } from "@/lib/format";
import type { SalesInvoiceDTO } from "@/types/selling";

/**
 * The printable invoice. Kept as a plain server component so it renders
 * identically on screen and on paper — the only thing that changes between
 * copies is the watermark word in the corner.
 *
 * Copies exist because a customer, the accounts file and the tax file each
 * need one, and a reprint must never be mistaken for a second sale: every
 * copy carries the same number and says which copy it is.
 */
export const INVOICE_COPIES = [
  { key: "original", label: "Original", forWhom: "Customer" },
  { key: "duplicate", label: "Duplicata", forWhom: "Accounts copy" },
  { key: "triplicate", label: "Triplicata", forWhom: "Tax copy" },
] as const;

export type InvoiceCopy = (typeof INVOICE_COPIES)[number]["key"];

export const isInvoiceCopy = (value: string | undefined): value is InvoiceCopy =>
  INVOICE_COPIES.some((c) => c.key === value);

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export interface InvoiceIssuer {
  readonly name: string;
  readonly legalName: string | null;
  readonly addressLine1: string | null;
  readonly city: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly taxId: string | null;
  readonly footerNote: string | null;
}

export const InvoiceDocument = ({
  invoice,
  issuer,
  copy,
  customerAddress,
}: {
  invoice: SalesInvoiceDTO;
  issuer: InvoiceIssuer;
  copy: InvoiceCopy;
  customerAddress: readonly string[];
}) => {
  const meta = INVOICE_COPIES.find((c) => c.key === copy) ?? INVOICE_COPIES[0];
  const isReprint = copy !== "original";

  return (
    <article className="mx-auto max-w-[210mm] bg-white p-8 text-sm text-zinc-900 print:p-0">
      {/* Header ------------------------------------------------------------ */}
      <header className="flex items-start justify-between gap-8 border-b pb-5">
        <div>
          <h1 className="text-xl font-bold">
            {issuer.legalName ?? issuer.name}
          </h1>
          <div className="mt-1 space-y-0.5 text-xs text-zinc-600">
            {issuer.addressLine1 && <p>{issuer.addressLine1}</p>}
            {issuer.city && <p>{issuer.city}</p>}
            {issuer.phone && <p>Tel {issuer.phone}</p>}
            {issuer.email && <p>{issuer.email}</p>}
            {issuer.taxId && <p>Tax ID {issuer.taxId}</p>}
          </div>
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold uppercase tracking-wide">
            {invoice.isReturn ? "Avoir" : "Facture"}
          </p>
          <p className="mt-1 font-mono text-sm font-medium">{invoice.number}</p>
          <span
            className={`mt-2 inline-block rounded border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
              isReprint
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-zinc-300 text-zinc-600"
            }`}
          >
            {meta.label}
          </span>
          <p className="mt-1 text-[11px] text-zinc-500">{meta.forWhom}</p>
        </div>
      </header>

      {/* Parties and dates ------------------------------------------------- */}
      <section className="mt-5 flex justify-between gap-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Facturé à
          </p>
          <p className="mt-1 font-medium">{invoice.customerName}</p>
          <div className="mt-0.5 space-y-0.5 text-xs text-zinc-600">
            {customerAddress.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <table className="text-xs">
          <tbody>
            <tr>
              <td className="pr-4 text-zinc-500">Date de facture</td>
              <td className="text-right font-medium">
                {formatDate(invoice.postingDate)}
              </td>
            </tr>
            <tr>
              <td className="pr-4 text-zinc-500">Échéance</td>
              <td className="text-right font-medium">
                {formatDate(invoice.dueDate)}
              </td>
            </tr>
            {invoice.salesOrderNumber && (
              <tr>
                <td className="pr-4 text-zinc-500">Commande</td>
                <td className="text-right font-mono">
                  {invoice.salesOrderNumber}
                </td>
              </tr>
            )}
            {invoice.deliveryNoteNumber && (
              <tr>
                <td className="pr-4 text-zinc-500">Livraison</td>
                <td className="text-right font-mono">
                  {invoice.deliveryNoteNumber}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Lines -------------------------------------------------------------- */}
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-y bg-zinc-50 text-left text-[11px] uppercase tracking-wide text-zinc-500">
            <th className="py-2 pl-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Qté</th>
            <th className="py-2 text-right font-medium">Prix</th>
            <th className="py-2 text-right font-medium">TVA</th>
            <th className="py-2 pr-2 text-right font-medium">Montant</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((line) => (
            <tr key={line.id} className="border-b">
              <td className="py-2 pl-2">
                <span className="font-medium">{line.itemName}</span>
                {line.description && (
                  <span className="block text-xs text-zinc-500">
                    {line.description}
                  </span>
                )}
              </td>
              <td className="py-2 text-right tabular-nums">{line.quantity}</td>
              <td className="py-2 text-right tabular-nums">
                {formatCurrency(line.rate)}
              </td>
              <td className="py-2 text-right tabular-nums text-zinc-500">
                {line.taxRate}%
              </td>
              <td className="py-2 pr-2 text-right tabular-nums">
                {formatCurrency(line.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals ------------------------------------------------------------- */}
      <section className="mt-4 flex justify-end">
        <table className="w-72 text-sm">
          <tbody>
            <tr>
              <td className="py-1 text-zinc-600">Sous-total</td>
              <td className="py-1 text-right tabular-nums">
                {formatCurrency(invoice.subtotal)}
              </td>
            </tr>
            {invoice.discountAmount > 0 && (
              <tr>
                <td className="py-1 text-zinc-600">Remise</td>
                <td className="py-1 text-right tabular-nums">
                  −{formatCurrency(invoice.discountAmount)}
                </td>
              </tr>
            )}
            <tr>
              <td className="py-1 text-zinc-600">TVA</td>
              <td className="py-1 text-right tabular-nums">
                {formatCurrency(invoice.taxTotal)}
              </td>
            </tr>
            {invoice.roundOff !== 0 && (
              <tr>
                <td className="py-1 text-zinc-600">Arrondi</td>
                <td className="py-1 text-right tabular-nums">
                  {formatCurrency(invoice.roundOff)}
                </td>
              </tr>
            )}
            <tr className="border-t">
              <td className="py-2 font-semibold">Total</td>
              <td className="py-2 text-right text-base font-semibold tabular-nums">
                {formatCurrency(invoice.grandTotal)}
              </td>
            </tr>
            {invoice.paidAmount > 0 && (
              <tr>
                <td className="py-1 text-zinc-600">Payé</td>
                <td className="py-1 text-right tabular-nums">
                  −{formatCurrency(invoice.paidAmount)}
                </td>
              </tr>
            )}
            <tr className="border-t">
              <td className="py-2 font-semibold">Reste à payer</td>
              <td
                className={`py-2 text-right text-base font-semibold tabular-nums ${
                  invoice.outstandingAmount > 0 ? "text-red-600" : ""
                }`}
              >
                {formatCurrency(invoice.outstandingAmount)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Payment schedule --------------------------------------------------- */}
      {invoice.schedule.length > 0 && (
        <section className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Échéancier
          </p>
          <table className="mt-1 w-full text-xs">
            <tbody>
              {invoice.schedule.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-1.5">{formatDate(row.dueDate)}</td>
                  <td className="py-1.5 text-zinc-500">
                    {row.invoicePortion}%
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-500">
                    paid {formatCurrency(row.paidAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Footer ------------------------------------------------------------- */}
      <footer className="mt-8 border-t pt-4 text-xs text-zinc-600">
        {invoice.notes && <p>{invoice.notes}</p>}
        {invoice.termsText && (
          <p className="mt-2 whitespace-pre-line">{invoice.termsText}</p>
        )}
        {issuer.footerNote && <p className="mt-2">{issuer.footerNote}</p>}
        {isReprint && (
          <p className="mt-3 font-medium text-red-700">
            Ceci est un {meta.label.toLowerCase()} de la facture {invoice.number}.
            Ce n&apos;est pas une seconde facturation.
          </p>
        )}
      </footer>
    </article>
  );
};
