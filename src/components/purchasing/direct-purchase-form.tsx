"use client";

import { PlusIcon, ScanTextIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { readReceiptAction, recordDirectPurchaseAction } from "@/actions/direct-purchase.actions";
import { FieldHint } from "@/components/forms/help-box";
import { ItemCombobox, type CreatedItem } from "@/components/forms/item-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  emptyBreakdown,
  parseAmount,
  toExpenseLines,
  type BreakdownState,
} from "@/lib/expense-breakdown-state";
import { humanError } from "@/lib/error-messages";
import { formatQuantity } from "@/lib/food-cost-format";
import { formatCurrency } from "@/lib/format";
import { UNIT_LABELS } from "@/lib/inventory";
import { CATEGORY_DEFAULT_VAT, CATEGORY_LABEL, breakdownTotals, type PurchaseCategory } from "@/lib/purchase-categories";
import type { ReceiptReading } from "@/lib/receipt-parser";
import {
  expenseLinesFrom,
  linesFromReading,
  stockLinesFrom,
  type ReceiptLineDraft,
} from "@/lib/receipt-lines-state";
import { cn } from "@/lib/utils";
import type { IngredientDTO } from "@/types/food-cost";

import { DocumentPicker, type PickedDocument } from "./document-picker";
import { ExpenseBreakdownEditor, newBreakdownRow } from "./expense-breakdown-editor";
import { ReceiptLinesTable } from "./receipt-lines-table";

const PAYMENT_OPTIONS = [
  { value: "CARD", label: "Carte bancaire" },
  { value: "CASH", label: "Espèces" },
  { value: "BANK_TRANSFER", label: "Virement" },
  { value: "CHEQUE", label: "Chèque" },
  { value: "OTHER", label: "Autre" },
] as const;
type PaymentValue = (typeof PAYMENT_OPTIONS)[number]["value"];

interface IngredientLine {
  readonly key: string;
  readonly stockItemId: string;
  readonly quantity: string;
  readonly amount: string;
}

let lineSeq = 0;
const newIngredientLine = (): IngredientLine => ({ key: `ing-${lineSeq++}`, stockItemId: "", quantity: "", amount: "" });

const amountText = (n: number): string => String(n).replace(".", ",");

/** The breakdown the reading suggests: one row per category found on the ticket. */
const breakdownFromReading = (reading: ReceiptReading): BreakdownState => {
  const base = emptyBreakdown();
  if (reading.lines.length === 0) return reading.totalTTC ? { ...base, mixed: false } : base;
  const sum = reading.lines.reduce((s, l) => s + l.amount, 0);
  const amountsAre = reading.totalHT != null && Math.abs(sum - reading.totalHT) <= 0.05 ? "HT" : "TTC";
  const groups = new Map<string, { category: PurchaseCategory; rate: number; amount: number; labels: string[] }>();
  for (const line of reading.lines) {
    const rate = line.vatRate ?? CATEGORY_DEFAULT_VAT[line.category];
    const key = `${line.category}-${rate}`;
    const group = groups.get(key) ?? { category: line.category, rate, amount: 0, labels: [] };
    group.amount += line.amount;
    if (group.labels.length < 3) group.labels.push(line.label.toLowerCase());
    groups.set(key, group);
  }
  const onlyFood = [...groups.values()].every((g) => g.category === "DENREES");
  if (onlyFood && groups.size === 1) {
    const [group] = groups.values();
    return { ...base, mixed: false, singleRate: group.rate };
  }
  return {
    ...base,
    mixed: true,
    amountsAre,
    rows: [...groups.values()].map((g) => ({
      ...newBreakdownRow(g.category, amountText(Math.round(g.amount * 100) / 100), g.labels.join(", ").slice(0, 110)),
      vatRate: g.rate,
    })),
  };
};

/**
 * A shop ticket in four steps on one page: the picture (read automatically
 * if wanted), where and when, what it was spent on, and — optionally — the
 * ingredients to put in stock with their new price.
 */
export function DirectPurchaseForm({
  suppliers,
  ingredients,
  today,
}: {
  readonly suppliers: readonly { readonly id: string; readonly name: string }[];
  readonly ingredients: readonly IngredientDTO[];
  readonly today: string;
}) {
  const router = useRouter();
  const [document, setDocument] = useState<PickedDocument | null>(null);
  const [reading, setReading] = useState<ReceiptReading | null>(null);
  const [readFields, setReadFields] = useState<ReadonlySet<string>>(new Set());
  const [supplierName, setSupplierName] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(today);
  const [ticketNumber, setTicketNumber] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentValue>("CARD");
  const [alreadyPaid, setAlreadyPaid] = useState(true);
  const [total, setTotal] = useState("");
  const [breakdown, setBreakdown] = useState<BreakdownState>(emptyBreakdown);
  const [ticketLines, setTicketLines] = useState<readonly ReceiptLineDraft[]>([]);
  const [amountsAre, setAmountsAre] = useState<"HT" | "TTC">("TTC");
  const [lines, setLines] = useState<readonly IngredientLine[]>([]);
  const [created, setCreated] = useState<readonly CreatedItem[]>([]);
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [reading_, startReading] = useTransition();
  const [saving, startSaving] = useTransition();

  const totalTTC = parseAmount(total) || undefined;
  // With a detailed ticket the lines are the truth: the category breakdown and
  // the stock entries are read off them rather than typed twice.
  const hasTicketLines = ticketLines.length > 0;
  const expenseLines = hasTicketLines ? expenseLinesFrom(ticketLines, amountsAre) : toExpenseLines(breakdown, totalTTC);
  const foodHT = breakdownTotals(expenseLines).foodHT;
  const detailedHT = lines.reduce((s, l) => s + parseAmount(l.amount), 0);

  const ingredientOf = (id: string) => {
    const known = ingredients.find((i) => i.id === id);
    if (known) return { name: known.name, unit: known.unit, purchaseUnit: known.purchaseUnit, purchaseFactor: known.purchaseFactor };
    const fresh = created.find((c) => c.id === id);
    return fresh ? { name: fresh.label, unit: fresh.unit, purchaseUnit: fresh.purchaseUnit, purchaseFactor: fresh.purchaseFactor } : null;
  };

  const markRead = (field: string, value: unknown) => (value == null || value === "" ? [] : [field]);

  const read = () => {
    if (!document) return;
    startReading(async () => {
      const data = new FormData();
      data.set("file", document.file);
      const result = await readReceiptAction(data);
      if (!result.success || !result.data) {
        toast.error(humanError(result.error));
        return;
      }
      const r = result.data;
      setReading(r);
      if (r.shopName && !supplierName) setSupplierName(r.shopName);
      if (r.date) setPurchasedAt(r.date);
      if (r.ticketNumber) setTicketNumber(r.ticketNumber);
      if (r.totalTTC != null) setTotal(amountText(r.totalTTC));
      if (r.paymentMode) setPaymentMode(r.paymentMode);
      setAmountsAre(r.amountsAre);
      if (r.lines.length > 0) setTicketLines(linesFromReading(r.lines));
      else setBreakdown(breakdownFromReading(r));
      setReadFields(
        new Set([
          ...markRead("supplierName", !supplierName ? r.shopName : null),
          ...markRead("purchasedAt", r.date),
          ...markRead("ticketNumber", r.ticketNumber),
          ...markRead("total", r.totalTTC),
          ...markRead("paymentMode", r.paymentMode),
        ]),
      );
      toast.success(
        r.confidence === "high"
          ? "Ticket lu : les montants concordent. Vérifiez puis enregistrez."
          : "Ticket lu en partie : vérifiez et complétez les champs.",
      );
    });
  };

  const save = () => {
    setFieldErrors({});
    startSaving(async () => {
      const payload = {
        supplierName: supplierName.trim() || undefined,
        purchasedAt: purchasedAt || undefined,
        ticketNumber: ticketNumber.trim() || undefined,
        paymentMode,
        alreadyPaid,
        totalTTC: totalTTC ?? 0,
        expenseLines,
        ingredientLines: hasTicketLines
          ? stockLinesFrom(ticketLines, amountsAre)
          : lines
              .filter((l) => l.stockItemId || l.quantity || l.amount)
              .map((l) => ({ stockItemId: l.stockItemId, quantity: parseAmount(l.quantity), amount: parseAmount(l.amount) })),
        notes: notes.trim() || undefined,
        source: document?.source,
      };
      const data = new FormData();
      data.set("payload", JSON.stringify(payload));
      if (document) data.set("file", document.file);
      const result = await recordDirectPurchaseAction(data);
      if (!result.success || !result.data) {
        const errors = Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([k, v]) => [k, v[0] ?? ""]));
        setFieldErrors(errors);
        toast.error(humanError(result.error));
        return;
      }
      toast.success(`Achat enregistré : ${result.data.number}`);
      router.push(`/dashboard/purchasing/invoices/${result.data.id}`);
      router.refresh();
    });
  };

  const readBadge = (field: string) =>
    readFields.has(field) ? (
      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[11px] font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
        <SparklesIcon className="size-3" aria-hidden />
        lu sur le ticket
      </span>
    ) : null;

  const lineErrors = Object.entries(fieldErrors).filter(([k]) => k.startsWith("ingredientLines"));
  const section = "flex flex-col gap-4 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 sm:p-5";
  const stepTitle = (n: number, title: string) => (
    <h2 className="flex items-center gap-2 text-base font-semibold">
      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{n}</span>
      {title}
    </h2>
  );

  return (
    <div className="flex flex-col gap-5">
      <section className={section}>
        {stepTitle(1, "Le ticket ou la facture")}
        <DocumentPicker value={document} onChange={setDocument} error={fieldErrors.file} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={read} disabled={!document || reading_}>
            <ScanTextIcon className="size-4" aria-hidden />
            {reading_ ? "Lecture en cours…" : "Lire le ticket"}
          </Button>
          <FieldHint>
            Lecture gratuite sur cet ordinateur, sans internet. Photo à plat, bien éclairée, ticket entier. Vérifiez chaque
            montant : la lecture automatique peut se tromper. Pas de ticket ? Passez directement à l&apos;étape 2.
          </FieldHint>
        </div>
        {reading && reading.lines.length > 0 ? (
          <details className="rounded-lg bg-muted/50 p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              {reading.lines.length} ligne{reading.lines.length > 1 ? "s" : ""} lue{reading.lines.length > 1 ? "s" : ""} sur le ticket
            </summary>
            <ul className="mt-2 divide-y">
              {reading.lines.map((line, index) => (
                <li key={index} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span>{line.label}</span>
                  <span className="flex items-center gap-2 tabular-nums">
                    <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground">{CATEGORY_LABEL[line.category]}</span>
                    {formatCurrency(line.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className={section}>
        {stepTitle(2, "Où, quand, combien")}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Magasin ou fournisseur</span>
            {readBadge("supplierName")}
            <Input
              list="direct-shops"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Metro, Carrefour, marché d'Aligre…"
              className="mt-1 h-11 text-base"
              aria-invalid={Boolean(fieldErrors.supplierName) || undefined}
            />
            <datalist id="direct-shops">
              {suppliers.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
            {fieldErrors.supplierName ? <p className="text-xs text-destructive">{fieldErrors.supplierName}</p> : null}
            <FieldHint>Choisissez dans la liste ou tapez un nouveau nom : il est ajouté aux fournisseurs.</FieldHint>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Date de l&apos;achat</span>
            {readBadge("purchasedAt")}
            <Input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} className="mt-1 h-11 text-base" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Total payé TTC (€)</span>
            {readBadge("total")}
            <Input
              inputMode="decimal"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="73,95"
              className="mt-1 h-11 text-right text-base"
              aria-invalid={Boolean(fieldErrors.totalTTC) || undefined}
            />
            {fieldErrors.totalTTC ? <p className="text-xs text-destructive">{fieldErrors.totalTTC}</p> : null}
            <FieldHint>Le montant en bas du ticket, celui qui a été débité.</FieldHint>
          </label>
          <label className="block text-sm">
            <span className="font-medium">N° du ticket ou de la facture</span>
            {readBadge("ticketNumber")}
            <Input value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} placeholder="facultatif" className="mt-1 h-11 text-base" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Payé par</span>
            {readBadge("paymentMode")}
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as PaymentValue)}
              className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-base"
            >
              {PAYMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-3 self-end rounded-lg border p-3 text-sm">
            <input type="checkbox" checked={alreadyPaid} onChange={(e) => setAlreadyPaid(e.target.checked)} className="mt-0.5 size-4" />
            <span>
              <span className="block font-medium">Déjà payé</span>
              <span className="text-muted-foreground">Décochez si le fournisseur vous a fait crédit : la facture restera à payer.</span>
            </span>
          </label>
        </div>
      </section>

      <section className={section}>
        {stepTitle(3, "Qu'avez-vous acheté ?")}
        {hasTicketLines ? (
          <>
            <FieldHint>
              Les {ticketLines.length} lignes lues sur le ticket. Corrigez ce qui ne va pas, donnez sa catégorie à chacune, et
              reliez à un ingrédient celles qui doivent entrer en stock. La répartition des dépenses en découle.
            </FieldHint>
            <ReceiptLinesTable
              lines={ticketLines}
              onChange={setTicketLines}
              ingredients={ingredients}
              amountsAre={amountsAre}
              ticketTotal={amountsAre === "TTC" ? totalTTC : undefined}
            />
            {fieldErrors.expenseLines ? <p className="text-sm text-destructive">{fieldErrors.expenseLines}</p> : null}
          </>
        ) : (
          <ExpenseBreakdownEditor value={breakdown} onChange={setBreakdown} totalTTC={totalTTC} error={fieldErrors.expenseLines} />
        )}
      </section>

      <section className={section} hidden={hasTicketLines}>
        {stepTitle(4, "Mettre des ingrédients en stock (facultatif)")}
        <FieldHint>
          Pour que le stock et le prix d&apos;achat suivent, détaillez les denrées : l&apos;ingrédient, la quantité dans
          l&apos;unité où vous l&apos;avez acheté (2 cartons, 5 kg) et son montant HT. Les produits d&apos;entretien et le
          matériel ne vont pas en stock.
        </FieldHint>
        {lines.map((line) => {
          const item = ingredientOf(line.stockItemId);
          const qty = parseAmount(line.quantity);
          const amount = parseAmount(line.amount);
          return (
            <div key={line.key} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,2fr)_8rem_8rem_2.25rem] sm:items-start sm:border-0 sm:p-0">
              <div>
                <ItemCombobox
                  label="Ingrédient"
                  placeholder="Tapez l'ingrédient…"
                  options={ingredients.map((i) => ({
                    id: i.id,
                    label: i.name,
                    hint: i.purchaseUnit ? `${i.purchaseUnit} · ${UNIT_LABELS[i.unit]}` : UNIT_LABELS[i.unit],
                  }))}
                  value={line.stockItemId}
                  onChange={(id, fresh) => {
                    if (fresh) setCreated((list) => [...list, fresh]);
                    setLines((all) => all.map((l) => (l.key === line.key ? { ...l, stockItemId: id } : l)));
                  }}
                />
                {item && qty > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    + {formatQuantity(qty * item.purchaseFactor, item.unit)} en stock
                    {amount > 0 ? ` · ${formatCurrency(amount / qty)} HT le ${item.purchaseUnit ?? UNIT_LABELS[item.unit]}` : ""}
                  </p>
                ) : null}
              </div>
              <Input
                aria-label="Quantité achetée"
                inputMode="decimal"
                value={line.quantity}
                onChange={(e) => setLines((all) => all.map((l) => (l.key === line.key ? { ...l, quantity: e.target.value } : l)))}
                placeholder={item?.purchaseUnit ? `nb ${item.purchaseUnit}` : "quantité"}
                className="h-11 text-right"
              />
              <Input
                aria-label="Montant HT"
                inputMode="decimal"
                value={line.amount}
                onChange={(e) => setLines((all) => all.map((l) => (l.key === line.key ? { ...l, amount: e.target.value } : l)))}
                placeholder="€ HT"
                className="h-11 text-right"
              />
              <button
                type="button"
                onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                className="flex h-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                aria-label="Retirer l'ingrédient"
              >
                <Trash2Icon className="size-4" />
              </button>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((all) => [...all, newIngredientLine()])}>
            <PlusIcon className="size-4" aria-hidden />
            Ajouter un ingrédient
          </Button>
          {lines.length > 0 ? (
            <span className={cn("text-sm tabular-nums", detailedHT > foodHT + 0.05 ? "text-destructive" : "text-muted-foreground")}>
              Détaillé : {formatCurrency(detailedHT)} HT sur {formatCurrency(foodHT)} HT de denrées et boissons
            </span>
          ) : null}
        </div>
        {lineErrors.length > 0 ? <p className="text-sm text-destructive">{lineErrors[0][1]}</p> : null}
      </section>

      <section className={section}>
        <label className="block text-sm">
          <span className="font-medium">Remarque</span>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={2} placeholder="Dépannage du samedi, promotion…" />
        </label>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {totalTTC ? <span className="text-sm text-muted-foreground">Total {formatCurrency(totalTTC)} TTC</span> : null}
          <Button size="lg" onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer l'achat"}
          </Button>
        </div>
      </section>
      <Toaster />
    </div>
  );
}
