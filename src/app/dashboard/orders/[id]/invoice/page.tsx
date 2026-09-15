import Link from "next/link";
import { notFound } from "next/navigation";

import { ReceiptPrintButton } from "@/components/orders/receipt-print-button";
import { formatVatRate } from "@/lib/french-vat";
import { formatDate, formatTime } from "@/lib/format";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import { cn } from "@/lib/utils";
import { getReceipt, ORDER_NOT_SETTLED } from "@/services/receipt.service";
import type { ReceiptDTO } from "@/types/receipt";

export const metadata = { title: "Facture" };

/** Amounts on a receipt: "12,50", the euro sign only on the grand total. */
const amount = (n: number): string =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Hr = () => <div className="my-2 border-t border-dashed border-black" />;

const Row = ({
  label,
  value,
  strong,
}: {
  readonly label: string;
  readonly value: string;
  readonly strong?: boolean;
}) => (
  <div className={cn("flex justify-between gap-2", strong && "text-[14px] font-bold")}>
    <span>{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);

function Receipt({ r }: { readonly r: ReceiptDTO }) {
  const s = r.seller;
  const idLine = [s.siret && `SIRET ${s.siret}`, s.nafCode && `NAF ${s.nafCode}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="mx-auto w-full max-w-[340px] bg-white p-4 font-mono text-[12px] leading-snug text-black shadow-sm ring-1 ring-black/10 print:max-w-none print:p-0 print:shadow-none print:ring-0">
      <header className="flex flex-col items-center text-center">
        <p className="text-[15px] font-bold uppercase">{s.name}</p>
        {s.legalName && s.legalName !== s.name ? <p>{s.legalName}</p> : null}
        {s.legalIdentity ? <p>{s.legalIdentity}</p> : null}
        {s.addressLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {s.phone ? <p>Tél. {s.phone}</p> : null}
        {s.email ? <p>{s.email}</p> : null}
        {idLine ? <p>{idLine}</p> : null}
        {s.vatNumber ? <p>TVA intracom. {s.vatNumber}</p> : null}
        {s.rcs ? <p>{s.rcs}</p> : null}
        {s.drinksLicense ? <p>{s.drinksLicense}</p> : null}
      </header>

      <Hr />

      <div className="text-center">
        <p className="text-[14px] font-bold">FACTURE {r.number}</p>
        {r.duplicateNumber != null ? (
          <p className="mt-1 border-2 border-black py-0.5 font-bold tracking-widest">
            DUPLICATA N° {r.duplicateNumber}
          </p>
        ) : null}
      </div>

      <div className="mt-2 flex flex-col gap-0.5">
        <div className="flex justify-between">
          <span>
            {formatDate(r.issuedAt)} {formatTime(r.issuedAt)}
          </span>
          <span className="font-bold">
            {r.serviceLabel}
            {r.tableLabel ? ` · ${r.tableLabel}` : ""}
          </span>
        </div>
        <span>Commande n° {r.orderNumber}</span>
        {r.customerName ? <span>Client : {r.customerName}</span> : null}
        {r.customerAddress ? <span>{r.customerAddress}</span> : null}
      </div>

      <Hr />

      <div className="flex font-bold">
        <span className="w-7">Qté</span>
        <span className="flex-1">Désignation</span>
        <span className="w-14 text-right">P.U.</span>
        <span className="w-16 text-right">Total</span>
        <span className="w-4" />
      </div>
      <Hr />
      <ul className="flex flex-col gap-1">
        {r.lines.map((line, i) => (
          <li key={i}>
            <div className="flex">
              <span className="w-7 tabular-nums">{line.quantity}</span>
              <span className="flex-1 pr-1">
                {line.name}
                {line.offered ? " (offert)" : ""}
              </span>
              <span className="w-14 text-right tabular-nums">{amount(line.unitTTC)}</span>
              <span className="w-16 text-right tabular-nums">{amount(line.totalTTC)}</span>
              <span className="w-4 text-right">{line.vatCode}</span>
            </div>
            {line.details.map((d) => (
              <p key={d} className="pl-7 text-[11px]">
                + {d}
              </p>
            ))}
          </li>
        ))}
      </ul>

      <Hr />

      <div className="flex flex-col gap-0.5">
        <Row label={`Sous-total TTC (${r.itemCount} art.)`} value={amount(r.subtotalTTC)} />
        {r.discountTTC !== 0 ? (
          <Row
            label={`Remise${r.discountReason ? ` (${r.discountReason})` : ""}`}
            value={`−${amount(r.discountTTC)}`}
          />
        ) : null}
        {r.roundingTTC !== 0 ? <Row label="Arrondi" value={amount(r.roundingTTC)} /> : null}
      </div>
      <Hr />
      <Row label="TOTAL TTC" value={`${amount(r.totalTTC)} €`} strong />
      <Hr />

      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left">
            <th className="font-bold">TVA</th>
            <th className="text-right font-bold">Taux</th>
            <th className="text-right font-bold">HT</th>
            <th className="text-right font-bold">TVA</th>
            <th className="text-right font-bold">TTC</th>
          </tr>
        </thead>
        <tbody>
          {r.vat.map((v) => (
            <tr key={v.code}>
              <td>{v.code}</td>
              <td className="text-right tabular-nums">{formatVatRate(v.rate)}</td>
              <td className="text-right tabular-nums">{amount(v.baseHT)}</td>
              <td className="text-right tabular-nums">{amount(v.vat)}</td>
              <td className="text-right tabular-nums">{amount(v.totalTTC)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td colSpan={2}>Total</td>
            <td className="text-right tabular-nums">{amount(r.totalHT)}</td>
            <td className="text-right tabular-nums">{amount(r.totalVAT)}</td>
            <td className="text-right tabular-nums">{amount(r.totalTTC)}</td>
          </tr>
        </tfoot>
      </table>

      {r.payments.length > 0 ? (
        <>
          <Hr />
          <div className="flex flex-col gap-0.5">
            {r.payments.map((p, i) => (
              <Row key={i} label={p.label} value={amount(p.amount)} />
            ))}
            {r.changeGiven > 0 ? <Row label="Rendu monnaie" value={amount(r.changeGiven)} /> : null}
          </div>
        </>
      ) : null}

      <Hr />
      <footer className="flex flex-col gap-1 text-center">
        {r.notices.map((n) => (
          <p key={n}>{n}</p>
        ))}
        {r.footer ? <p className="whitespace-pre-line">{r.footer}</p> : null}
      </footer>
    </article>
  );
}

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copy?: string }>;
}) {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    notFound();
  }
  const { id } = await params;
  const { copy } = await searchParams;
  const duplicate = copy === "1" || copy === "duplicata";

  let receipt: ReceiptDTO;
  try {
    receipt = await getReceipt(ctx.restaurantId, id, duplicate);
  } catch (error) {
    if (error instanceof Error && error.message === ORDER_NOT_SETTLED) {
      return (
        <div className="mx-auto flex max-w-sm flex-col gap-2 p-6 text-center text-sm">
          <p>
            Cette commande n&apos;est pas encore encaissée : la facture sera disponible après le
            paiement.
          </p>
          <Link href={`/dashboard/orders/${id}`} className="underline">
            Retour à la commande
          </Link>
        </div>
      );
    }
    notFound();
  }

  return (
    <div className="flex flex-col gap-4 p-4 print:p-0">
      <div className="mx-auto flex w-full max-w-[340px] flex-wrap items-center justify-between gap-2 print:hidden">
        <nav className="flex rounded-lg bg-muted p-0.5 text-xs font-medium" aria-label="Exemplaire">
          <Link
            href={`/dashboard/orders/${id}/invoice`}
            aria-current={!duplicate ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1",
              !duplicate ? "bg-background shadow-xs" : "text-muted-foreground",
            )}
          >
            Original
          </Link>
          <Link
            href={`/dashboard/orders/${id}/invoice?copy=1`}
            aria-current={duplicate ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1",
              duplicate ? "bg-background shadow-xs" : "text-muted-foreground",
            )}
          >
            Duplicata
          </Link>
        </nav>
        <ReceiptPrintButton orderId={id} duplicate={duplicate} />
      </div>
      <Receipt r={receipt} />
      <p className="mx-auto max-w-[340px] text-center text-xs text-muted-foreground print:hidden">
        <Link href="/dashboard/sales" className="underline underline-offset-2">
          Toutes les factures de vente
        </Link>
      </p>
    </div>
  );
}
