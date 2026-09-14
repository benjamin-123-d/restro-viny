"use client";

import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/format";
import type { Heatmap, ItemRow, PaymentRow, ServiceRow } from "@/lib/sales-analytics";
import { cn } from "@/lib/utils";

import { ChartCard, DataTable } from "./chart-card";
import {
  formatEuroShort,
  formatPercent,
  paymentName,
  SERVICE_NAME,
  SERVICE_SWATCH,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
} from "./sales-labels";

/** A mark with a hover/focus tooltip; the hit area is the whole wrapper. */
function Tip({
  content,
  className,
  style,
  children,
  label,
}: {
  readonly content: ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly children?: ReactNode;
  readonly label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<div role="img" aria-label={label} tabIndex={0} className={className} style={style} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-0.5">{content}</TooltipContent>
    </Tooltip>
  );
}

// ------------------------------------------------------------ by service ---

export function ServiceSplitChart({ services }: { readonly services: readonly ServiceRow[] }) {
  const sold = services.filter((s) => s.ttc > 0);
  const total = services.reduce((s, r) => s + r.ttc, 0);

  return (
    <ChartCard
      title="Sur place, à emporter, livraison"
      description="Part de chaque mode de service dans le chiffre d'affaires TTC."
      legend={services.map((s) => ({ label: SERVICE_NAME[s.service], swatch: SERVICE_SWATCH[s.service] }))}
      chart={
        total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucune vente sur la période.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {/* One whole, split in parts: a single bar reads better than a pie. */}
            <div className="flex h-6 w-full gap-0.5">
              {sold.map((s, i) => (
                <Tip
                  key={s.service}
                  label={`${SERVICE_NAME[s.service]} : ${formatPercent(s.share)}`}
                  className={cn(
                    "h-full outline-offset-2",
                    SERVICE_SWATCH[s.service],
                    i === 0 && "rounded-l-[4px]",
                    i === sold.length - 1 && "rounded-r-[4px]",
                  )}
                  style={{ width: `${s.share}%` }}
                  content={
                    <>
                      <span className="font-medium">{SERVICE_NAME[s.service]}</span>
                      <span>
                        {formatCurrency(s.ttc)} TTC · {formatPercent(s.share)}
                      </span>
                      <span>
                        {s.tickets} tickets · ticket moyen {formatCurrency(s.averageTicket)}
                      </span>
                    </>
                  }
                />
              ))}
            </div>

            <ul className="grid gap-3 sm:grid-cols-3">
              {services.map((s) => (
                <li key={s.service} className="rounded-lg border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className={cn("size-2.5 rounded-[3px]", SERVICE_SWATCH[s.service])} aria-hidden />
                    {SERVICE_NAME[s.service]}
                  </p>
                  <p className="mt-1.5 text-xl font-semibold tabular-nums">{formatPercent(s.share)}</p>
                  <p className="text-sm tabular-nums text-foreground">{formatCurrency(s.ttc)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.tickets} tickets
                    {s.tickets > 0 ? ` · moy. ${formatCurrency(s.averageTicket)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )
      }
      table={
        <DataTable
          headers={[
            { label: "Service" },
            { label: "Tickets", numeric: true },
            { label: "Ticket moyen", numeric: true },
            { label: "CA TTC", numeric: true },
            { label: "Part", numeric: true },
          ]}
          rows={services.map((s) => [
            SERVICE_NAME[s.service],
            s.tickets,
            formatCurrency(s.averageTicket),
            formatCurrency(s.ttc),
            formatPercent(s.share),
          ])}
        />
      }
    />
  );
}

// ------------------------------------------ meals and drinks per service ---

export function FoodDrinkByServiceChart({ services }: { readonly services: readonly ServiceRow[] }) {
  const peak = Math.max(1, ...services.map((s) => s.ttc));

  return (
    <ChartCard
      title="Repas et boissons, par service"
      description="Chiffre d'affaires TTC de chaque mode de service, repas et boissons à part."
      legend={[
        { label: "Repas", swatch: "bg-sales-food" },
        { label: "Boissons", swatch: "bg-sales-drink" },
      ]}
      chart={
        <ul className="flex flex-col gap-4">
          {services.map((s) => {
            const drinkShare = s.ttc ? (s.drinkTTC / s.ttc) * 100 : 0;
            return (
              <li key={s.service} className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
                <span className="text-sm font-medium">{SERVICE_NAME[s.service]}</span>
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-6 min-w-0 gap-0.5"
                    style={{ width: `${Math.max((s.ttc / peak) * 100, s.ttc ? 2 : 0)}%` }}
                  >
                    {s.foodTTC > 0 ? (
                      <Tip
                        label={`${SERVICE_NAME[s.service]}, repas : ${formatCurrency(s.foodTTC)}`}
                        className={cn("h-full bg-sales-food", s.drinkTTC > 0 ? "rounded-l-[4px]" : "rounded-[4px]")}
                        style={{ width: `${100 - drinkShare}%` }}
                        content={
                          <>
                            <span className="font-medium">{SERVICE_NAME[s.service]} — repas</span>
                            <span>
                              {formatCurrency(s.foodTTC)} TTC · {formatCurrency(s.foodHT)} HT
                            </span>
                          </>
                        }
                      />
                    ) : null}
                    {s.drinkTTC > 0 ? (
                      <Tip
                        label={`${SERVICE_NAME[s.service]}, boissons : ${formatCurrency(s.drinkTTC)}`}
                        className={cn("h-full bg-sales-drink", s.foodTTC > 0 ? "rounded-r-[4px]" : "rounded-[4px]")}
                        style={{ width: `${drinkShare}%` }}
                        content={
                          <>
                            <span className="font-medium">{SERVICE_NAME[s.service]} — boissons</span>
                            <span>
                              {formatCurrency(s.drinkTTC)} TTC · {formatCurrency(s.drinkHT)} HT
                            </span>
                          </>
                        }
                      />
                    ) : null}
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {s.ttc ? formatEuroShort(s.ttc) : "—"}
                  </span>
                </div>
                {s.ttc > 0 ? (
                  <p className="col-start-2 -mt-2.5 text-xs text-muted-foreground">
                    Repas {formatEuroShort(s.foodTTC)} · Boissons {formatEuroShort(s.drinkTTC)} (
                    {formatPercent(drinkShare, 0)})
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      }
      table={
        <DataTable
          headers={[
            { label: "Service" },
            { label: "Repas TTC", numeric: true },
            { label: "Boissons TTC", numeric: true },
            { label: "Total TTC", numeric: true },
          ]}
          rows={services.map((s) => [
            SERVICE_NAME[s.service],
            formatCurrency(s.foodTTC),
            formatCurrency(s.drinkTTC),
            formatCurrency(s.ttc),
          ])}
        />
      }
    />
  );
}

// ---------------------------------------------------------------- heatmap ---

const HEAT_CLASS = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4", "bg-heat-5"];
const heatStep = (value: number, max: number): number =>
  value <= 0 || max <= 0 ? 0 : Math.min(5, Math.ceil((value / max) * 5));

export function HourHeatmap({ heatmap }: { readonly heatmap: Heatmap }) {
  const first = Math.min(heatmap.firstHour, 11);
  const last = Math.max(heatmap.lastHour, 22);
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const stepValue = heatmap.max / 5;

  return (
    <ChartCard
      title="Affluence par jour et par heure"
      description="Cumul du chiffre d'affaires TTC sur la période : plus la case est foncée, plus le créneau rapporte."
      chart={
        heatmap.max === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucune vente sur la période.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto pb-1">
              <div
                className="grid min-w-[420px] gap-0.5"
                style={{ gridTemplateColumns: `2.25rem repeat(${hours.length}, minmax(0, 1fr))` }}
              >
                <span />
                {hours.map((h) => (
                  <span key={h} className="text-center text-[10px] tabular-nums text-muted-foreground">
                    {h % 2 === 0 || hours.length <= 12 ? `${h}h` : ""}
                  </span>
                ))}
                {heatmap.cells.map((row, day) => (
                  <div key={day} className="contents">
                    <span className="flex items-center text-xs text-muted-foreground">{WEEKDAY_SHORT[day]}</span>
                    {hours.map((h) => {
                      const value = row[h] ?? 0;
                      return (
                        <Tip
                          key={h}
                          label={`${WEEKDAY_LONG[day]} ${h} h : ${formatCurrency(value)}`}
                          className={cn(
                            "h-7 rounded-[3px] outline-offset-1",
                            HEAT_CLASS[heatStep(value, heatmap.max)],
                          )}
                          content={
                            <>
                              <span className="font-medium">
                                {WEEKDAY_LONG[day]}, {h} h – {h + 1} h
                              </span>
                              <span>{value ? `${formatCurrency(value)} TTC` : "Aucune vente"}</span>
                            </>
                          }
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Moins</span>
              {HEAT_CLASS.map((cls, i) => (
                <span key={cls} className={cn("h-3 w-6 rounded-[3px]", cls)} aria-hidden title={`niveau ${i}`} />
              ))}
              <span>Plus</span>
              <span className="ml-2 tabular-nums">
                (chaque niveau ≈ {formatEuroShort(stepValue)}, maximum {formatEuroShort(heatmap.max)})
              </span>
            </div>
          </div>
        )
      }
      table={
        <DataTable
          headers={[{ label: "Jour" }, ...hours.map((h) => ({ label: `${h} h`, numeric: true }))]}
          rows={heatmap.cells.map((row, day) => [
            WEEKDAY_LONG[day],
            ...hours.map((h) => (row[h] ? formatEuroShort(row[h]) : "—")),
          ])}
        />
      }
    />
  );
}

// -------------------------------------------------------------- top items ---

export function TopItemsChart({ items }: { readonly items: readonly ItemRow[] }) {
  const peak = Math.max(1, ...items.map((i) => i.ttc));

  return (
    <ChartCard
      title="Les 10 articles qui rapportent le plus"
      description="Classés par chiffre d'affaires TTC, quantités vendues entre parenthèses."
      legend={[
        { label: "Repas", swatch: "bg-sales-food" },
        { label: "Boissons", swatch: "bg-sales-drink" },
      ]}
      chart={
        items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucune vente sur la période.</p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {items.map((item, rank) => {
              const drink = item.vatCategory !== "FOOD";
              return (
                <li key={item.name} className="grid grid-cols-[1.25rem_minmax(0,9rem)_1fr] items-center gap-2 text-sm">
                  <span className="text-xs tabular-nums text-muted-foreground">{rank + 1}</span>
                  <span className="truncate" title={item.name}>
                    {item.name}
                  </span>
                  <div className="flex min-w-0 items-center gap-2">
                    <Tip
                      label={`${item.name} : ${formatCurrency(item.ttc)}`}
                      className={cn(
                        "h-4 shrink-0 rounded-r-[4px]",
                        drink ? "bg-sales-drink" : "bg-sales-food",
                      )}
                      style={{ width: `${Math.max(2, (item.ttc / peak) * 70)}%` }}
                      content={
                        <>
                          <span className="font-medium">{item.name}</span>
                          <span>
                            {formatCurrency(item.ttc)} TTC · {item.quantity} vendus
                          </span>
                          <span>{drink ? "Boisson" : "Repas"}</span>
                        </>
                      }
                    />
                    <span className="shrink-0 tabular-nums">
                      {formatEuroShort(item.ttc)}{" "}
                      <span className="text-xs text-muted-foreground">({item.quantity})</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )
      }
      table={
        <DataTable
          headers={[
            { label: "Rang", numeric: true },
            { label: "Article" },
            { label: "Type" },
            { label: "Quantité", numeric: true },
            { label: "CA TTC", numeric: true },
          ]}
          rows={items.map((item, rank) => [
            rank + 1,
            item.name,
            item.vatCategory === "FOOD" ? "Repas" : "Boisson",
            item.quantity,
            formatCurrency(item.ttc),
          ])}
        />
      }
    />
  );
}

// --------------------------------------------------------------- payments ---

export function PaymentMixChart({ payments }: { readonly payments: readonly PaymentRow[] }) {
  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <ChartCard
      title="Moyens de paiement"
      description="Montants encaissés par moyen de paiement."
      chart={
        payments.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucun encaissement sur la période.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {payments.map((p) => (
              <li key={p.mode} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{paymentName(p.mode)}</span>
                  <span className="tabular-nums">
                    <span className="font-semibold">{formatCurrency(p.amount)}</span>{" "}
                    <span className="text-xs text-muted-foreground">{formatPercent(p.share)}</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <Tip
                    label={`${paymentName(p.mode)} : ${formatPercent(p.share)}`}
                    className="h-full rounded-full bg-muted-foreground"
                    style={{ width: `${p.share}%` }}
                    content={
                      <>
                        <span className="font-medium">{paymentName(p.mode)}</span>
                        <span>
                          {formatCurrency(p.amount)} · {p.count} paiement{p.count > 1 ? "s" : ""}
                        </span>
                      </>
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )
      }
      table={
        <DataTable
          headers={[
            { label: "Moyen de paiement" },
            { label: "Paiements", numeric: true },
            { label: "Montant", numeric: true },
            { label: "Part", numeric: true },
          ]}
          rows={payments.map((p) => [
            paymentName(p.mode),
            p.count,
            formatCurrency(p.amount),
            formatPercent(p.share),
          ])}
          footer={["Total", payments.reduce((n, p) => n + p.count, 0), formatCurrency(total), "100 %"]}
        />
      }
    />
  );
}
