"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { formatCurrency, TIME_ZONE } from "@/lib/format";
import type { DailyPoint } from "@/lib/sales-analytics";

import { ChartCard, DataTable } from "./chart-card";
import { ChartStory, readIndex, useChartStory } from "./chart-story";
import { formatEuroShort, formatPercent } from "./sales-labels";

const config = {
  foodTTC: { label: "Repas", color: "var(--sales-food)" },
  drinkTTC: { label: "Boissons", color: "var(--sales-drink)" },
} satisfies ChartConfig;

interface Point extends DailyPoint {
  /** Axis label. */
  readonly label: string;
  /** Story heading and table heading. */
  readonly title: string;
  /** Set on the best bar only, so exactly one bar carries a direct label. */
  readonly peakValue: number | null;
}

const noon = (day: string) => new Date(`${day}T12:00:00Z`);

const fmt = (day: string, options: Intl.DateTimeFormatOptions) =>
  noon(day).toLocaleDateString("fr-FR", { timeZone: TIME_ZONE, ...options });

/** Beyond two months a bar per day is too thin to read: group by week. */
const WEEKLY_AFTER = 62;

const withPeak = (rows: readonly (DailyPoint & { label: string; title: string })[]): Point[] => {
  const peak = rows.reduce((best, row, i) => (row.totalTTC > (rows[best]?.totalTTC ?? 0) ? i : best), 0);
  // recharts skips null label values, which is how a single bar gets its number.
  return rows.map((row, i) => ({ ...row, peakValue: i === peak && row.totalTTC > 0 ? row.totalTTC : null }));
};

const toPoints = (daily: readonly DailyPoint[]): { points: Point[]; weekly: boolean } => {
  if (daily.length <= WEEKLY_AFTER) {
    const short = daily.length <= 14;
    return {
      weekly: false,
      points: withPeak(
        daily.map((d) => ({
          ...d,
          label: short ? fmt(d.day, { weekday: "short", day: "numeric" }) : fmt(d.day, { day: "2-digit", month: "2-digit" }),
          title: fmt(d.day, { weekday: "long", day: "numeric", month: "long" }),
        })),
      ),
    };
  }

  const weeks = new Map<string, { food: number; drink: number; tickets: number }>();
  for (const d of daily) {
    const weekday = (noon(d.day).getUTCDay() + 6) % 7;
    const monday = new Date(noon(d.day).getTime() - weekday * 86_400_000).toISOString().slice(0, 10);
    const w = weeks.get(monday) ?? { food: 0, drink: 0, tickets: 0 };
    w.food += d.foodTTC;
    w.drink += d.drinkTTC;
    w.tickets += d.tickets;
    weeks.set(monday, w);
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    weekly: true,
    points: withPeak(
      [...weeks.entries()].map(([day, w]) => ({
        day,
        foodTTC: r2(w.food),
        drinkTTC: r2(w.drink),
        totalTTC: r2(w.food + w.drink),
        tickets: w.tickets,
        label: fmt(day, { day: "numeric", month: "short" }),
        title: `semaine du ${fmt(day, { day: "numeric", month: "long" })}`,
      })),
    ),
  };
};

/** Values lead, labels follow; the swatch carries the series, never the text. */
function DailyTooltip({
  active,
  payload,
}: {
  readonly active?: boolean;
  readonly payload?: readonly { readonly payload?: Point }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold tabular-nums text-foreground">{formatCurrency(point.totalTTC)} TTC</p>
      <p className="mb-1.5 capitalize text-muted-foreground">{point.title}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-0.5 w-3 rounded-full bg-sales-food" aria-hidden />
          Repas
        </dt>
        <dd className="text-right tabular-nums text-foreground">{formatCurrency(point.foodTTC)}</dd>
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-0.5 w-3 rounded-full bg-sales-drink" aria-hidden />
          Boissons
        </dt>
        <dd className="text-right tabular-nums text-foreground">{formatCurrency(point.drinkTTC)}</dd>
        <dt className="text-muted-foreground">Tickets</dt>
        <dd className="text-right tabular-nums text-foreground">{point.tickets}</dd>
      </dl>
    </div>
  );
}

export function DailySalesChart({ daily }: { readonly daily: readonly DailyPoint[] }) {
  const { points, weekly } = toPoints(daily);
  const story = useChartStory(points.length);
  const reducedMotion = usePrefersReducedMotion();

  const withSales = points.filter((p) => p.totalTTC > 0);
  const average = withSales.length ? withSales.reduce((s, p) => s + p.totalTTC, 0) / withSales.length : 0;
  const peak = points.reduce((best, p) => (p.totalTTC > best.totalTTC ? p : best), points[0]);
  const unit = weekly ? "semaine" : "jour";

  const totals = points.reduce(
    (t, p) => ({ food: t.food + p.foodTTC, drink: t.drink + p.drinkTTC, tickets: t.tickets + p.tickets }),
    { food: 0, drink: 0, tickets: 0 },
  );
  const total = totals.food + totals.drink;

  // The sentence: the whole period by default, the pointed-at bar otherwise.
  const point = story.active != null ? points[story.active] : null;
  const lead = point
    ? point.title
    : `${withSales.length} ${unit}${withSales.length > 1 ? "s" : ""} de vente`;
  const parts = point
    ? [
        { label: "TTC", value: formatCurrency(point.totalTTC) },
        { label: "repas", value: formatCurrency(point.foodTTC), swatch: "bg-sales-food" },
        { label: "boissons", value: formatCurrency(point.drinkTTC), swatch: "bg-sales-drink" },
        { label: point.tickets > 1 ? "tickets" : "ticket", value: String(point.tickets) },
        ...(point.tickets > 0 ? [{ label: "le ticket", value: formatCurrency(point.totalTTC / point.tickets) }] : []),
      ]
    : [
        { label: "TTC sur la période", value: formatCurrency(total) },
        { label: "repas", value: formatCurrency(totals.food), swatch: "bg-sales-food" },
        { label: "boissons", value: formatCurrency(totals.drink), swatch: "bg-sales-drink" },
        { label: `par ${unit} travaillé${weekly ? "e" : ""}`, value: formatCurrency(average) },
      ];
  const note = point
    ? point.totalTTC === 0
      ? "Aucune vente ce jour-là."
      : `${formatPercent((point.foodTTC / point.totalTTC) * 100, 0)} de repas · ${
          point.totalTTC >= average ? "au-dessus" : "en dessous"
        } de la moyenne (${formatEuroShort(average)})`
    : peak && peak.totalTTC > 0
      ? `Meilleur${weekly ? "e" : ""} ${unit} : ${peak.title}, ${formatCurrency(peak.totalTTC)}.`
      : undefined;

  return (
    <ChartCard
      title={`Chiffre d'affaires par ${unit}`}
      description={`Repas et boissons empilés, en euros TTC. La ligne pointillée donne la moyenne par ${unit} travaillé${weekly ? "e" : ""}.`}
      legend={[
        { label: "Repas", swatch: "bg-sales-food" },
        { label: "Boissons", swatch: "bg-sales-drink" },
      ]}
      story={withSales.length > 0 ? <ChartStory lead={lead} parts={parts} note={note} pinned={story.pinned} /> : null}
      chart={
        withSales.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Aucune vente sur la période.</p>
        ) : (
          <div
            tabIndex={0}
            role="group"
            aria-label={`Chiffre d'affaires par ${unit} : flèches gauche et droite pour parcourir`}
            onKeyDown={story.onKeyDown}
            className="rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
              <BarChart
                data={points}
                margin={{ left: 0, right: 96, top: 28, bottom: 0 }}
                barCategoryGap="22%"
                onMouseMove={(state) => story.hover(readIndex(state))}
                onMouseLeave={() => story.hover(null)}
                onClick={(state) => story.pin(readIndex(state))}
              >
                <CartesianGrid vertical={false} strokeDasharray="0" />
                <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<DailyTooltip />} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tickMargin={8}
                  interval="preserveStartEnd"
                  minTickGap={18}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickCount={5}
                  tickFormatter={(v: number) => formatEuroShort(v)}
                />
                <ReferenceLine
                  y={average}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Moyenne ${formatEuroShort(average)}`,
                    position: "right",
                    className: "fill-muted-foreground text-[11px]",
                  }}
                />
                <Bar
                  dataKey="foodTTC"
                  stackId="ca"
                  fill="var(--color-foodTTC)"
                  maxBarSize={24}
                  isAnimationActive={!reducedMotion}
                />
                <Bar
                  dataKey="drinkTTC"
                  stackId="ca"
                  stroke="var(--card)"
                  strokeWidth={2}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  fill="var(--color-drinkTTC)"
                  isAnimationActive={!reducedMotion}
                >
                  <LabelList
                    dataKey="peakValue"
                    position="top"
                    offset={10}
                    className="fill-foreground text-[11px] font-semibold"
                    formatter={(value: unknown) => (typeof value === "number" ? formatEuroShort(value) : "")}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        )
      }
      table={
        <DataTable
          headers={[
            { label: weekly ? "Semaine" : "Jour" },
            { label: "Repas TTC", numeric: true },
            { label: "Boissons TTC", numeric: true },
            { label: "Total TTC", numeric: true },
            { label: "Tickets", numeric: true },
          ]}
          rows={points.map((p) => [
            <span key="d" className="capitalize">
              {p.title}
            </span>,
            formatCurrency(p.foodTTC),
            formatCurrency(p.drinkTTC),
            formatCurrency(p.totalTTC),
            p.tickets,
          ])}
          footer={[
            "Total",
            formatCurrency(totals.food),
            formatCurrency(totals.drink),
            formatCurrency(total),
            totals.tickets,
          ]}
        />
      }
    />
  );
}
