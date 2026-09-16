"use client";

import { SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { FieldHint } from "@/components/forms/help-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SERVICE_NAME, SERVICE_ORDER } from "@/components/sales/sales-labels";
import type { TicketFilterValues } from "@/lib/ticket-filter-params";

const SORTS = [
  { value: "recent", label: "Du plus récent" },
  { value: "ancien", label: "Du plus ancien" },
  { value: "montant", label: "Du plus gros montant" },
  { value: "montant-asc", label: "Du plus petit montant" },
];

const QUICK: readonly { label: string; days: number }[] = [
  { label: "Aujourd'hui", days: 0 },
  { label: "7 jours", days: 6 },
  { label: "30 jours", days: 29 },
  { label: "90 jours", days: 89 },
];

const dayString = (offsetDays: number): string => {
  const now = new Date();
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  paris.setDate(paris.getDate() - offsetDays);
  return `${paris.getFullYear()}-${String(paris.getMonth() + 1).padStart(2, "0")}-${String(paris.getDate()).padStart(2, "0")}`;
};

/**
 * Every filter a restaurant asks for, in one row above the list: dates,
 * service, payment, dish, amount, discount, and free text. The filters live in
 * the address, so a filtered view can be bookmarked, shared or printed.
 */
export function TicketFilters({
  values,
  payments,
  dishes,
  resultCount,
}: {
  readonly values: TicketFilterValues;
  readonly payments: readonly { readonly mode: string; readonly label: string }[];
  readonly dishes: readonly { readonly id: string; readonly name: string }[];
  readonly resultCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [draft, setDraft] = useState<TicketFilterValues>(values);
  const [open, setOpen] = useState(false);

  const apply = (next: Partial<TicketFilterValues>) => {
    const merged = { ...draft, ...next };
    setDraft(merged);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    router.push(`${pathname}?${query.toString()}`);
  };

  const active = Object.entries(values).filter(([key, value]) => value && key !== "tri").length;
  const exportHref = `/api/sales/tickets/export?${params.toString()}`;
  const field = "h-10 w-full rounded-md border bg-background px-2 text-sm";

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 print:hidden">
      <div className="flex flex-wrap items-end gap-2">
        {QUICK.map((q) => (
          <Button
            key={q.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => apply({ from: dayString(q.days), to: dayString(0) })}
          >
            {q.label}
          </Button>
        ))}
        <div className="ml-auto flex items-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Moins de filtres" : "Plus de filtres"}
            {active > 0 ? <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{active}</span> : null}
          </Button>
          <Button type="button" variant="outline" size="sm" render={<a href={exportHref} />}>
            Exporter (Excel)
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="font-medium">Du</span>
          <Input type="date" value={draft.from} onChange={(e) => apply({ from: e.target.value })} className="mt-1 h-10" />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Au</span>
          <Input type="date" value={draft.to} onChange={(e) => apply({ to: e.target.value })} className="mt-1 h-10" />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">Rechercher</span>
          <span className="relative mt-1 block">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={draft.search}
              onChange={(e) => setDraft({ ...draft, search: e.target.value })}
              onBlur={() => apply({ search: draft.search })}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply({ search: draft.search });
              }}
              placeholder="N° de ticket, table, client, plat…"
              className="h-10 pl-8"
            />
          </span>
        </label>
      </div>

      {open ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="font-medium">Service</span>
            <select value={draft.service} onChange={(e) => apply({ service: e.target.value })} className={`mt-1 ${field}`}>
              <option value="">Tous</option>
              {SERVICE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {SERVICE_NAME[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Moyen de paiement</span>
            <select value={draft.payment} onChange={(e) => apply({ payment: e.target.value })} className={`mt-1 ${field}`}>
              <option value="">Tous</option>
              {payments.map((p) => (
                <option key={p.mode} value={p.mode}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Plat contenu</span>
            <select value={draft.menuItemId} onChange={(e) => apply({ menuItemId: e.target.value })} className={`mt-1 ${field}`}>
              <option value="">Tous</option>
              {dishes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <FieldHint>Ne garde que les tickets où ce plat a été vendu.</FieldHint>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Trier</span>
            <select value={draft.tri || "recent"} onChange={(e) => apply({ tri: e.target.value })} className={`mt-1 ${field}`}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Montant TTC minimum</span>
            <Input
              inputMode="decimal"
              value={draft.min}
              onChange={(e) => setDraft({ ...draft, min: e.target.value })}
              onBlur={() => apply({ min: draft.min })}
              placeholder="€"
              className="mt-1 h-10 text-right"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Montant TTC maximum</span>
            <Input
              inputMode="decimal"
              value={draft.max}
              onChange={(e) => setDraft({ ...draft, max: e.target.value })}
              onBlur={() => apply({ max: draft.max })}
              placeholder="€"
              className="mt-1 h-10 text-right"
            />
          </label>
          <label className="flex items-center gap-2 self-end rounded-md border p-2 text-sm">
            <input
              type="checkbox"
              checked={draft.remise === "1"}
              onChange={(e) => apply({ remise: e.target.checked ? "1" : "" })}
              className="size-4"
            />
            Avec remise seulement
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {resultCount} ticket{resultCount > 1 ? "s" : ""} correspondent aux filtres.
        </span>
        {active > 0 ? (
          <Link href={pathname} className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
            <XIcon className="size-3.5" aria-hidden />
            Tout effacer
          </Link>
        ) : null}
      </div>
    </section>
  );
}
