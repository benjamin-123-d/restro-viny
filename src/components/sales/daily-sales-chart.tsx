"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency, TIME_ZONE } from "@/lib/format";
import type { DailyPoint } from "@/lib/sales-analytics";

import { ChartCard, DataTable } from "./chart-card";
import { formatEuroShort } from "./sales-labels";

const config = {
  foodTTC: { label: "Repas", color: "var(--sales-food)" },
  drinkTTC: { label: "Boissons", color: "var(--sales-drink)" },
} satisfies ChartConfig;

interface Point extends DailyPoint {
  /** Axis label. */
  readonly label: string;
  /** Tooltip / table heading. */
  readonly title: string;
}

const noon = (day: string) => new Date(`${day}T12:00:00Z`);

const fmt = (day: string, options: Intl.DateTimeFormatOptions) =>
  noon(day).toLocaleDateString("fr-FR", { timeZone: TIME_ZONE, ...options });

/** Beyond two months a bar per day is too thin to read: group by week. */
const WEEKLY_AFTER = 62;

const toPoints = (daily: readonly DailyPoint[]): { points: Point[]; weekly: boolean } => {
  if (daily.length <= WEEKLY_AFTER) {
    const short = daily.length <= 14;
    return {
      weekly: false,
      points: daily.map((d) => ({
        ...d,
        label: short
          ? fmt(d.day, { weekday: "short", day: "numeric" })
          : fmt(d.day, { day: "2-digit", month: "2-digit" }),
        title: fmt(d.day, { weekday: "long", day: "numeric", month: "long" }),
      })),
    };
  }

  const weeks = new Map<string, { food: number; drink: number; tickets: number }>();
  for (const d of daily) {
    const weekday = (noon(d.day).getUTCDay() + 6) % 7;
    const monday = new Date(noon(d.day).getTime() - weekday * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const w = weeks.get(monday) ?? { food: 0, drink: 0, tickets: 0 };
    w.food += d.foodTTC;
    w.drink += d.drinkTTC;
    w.tickets += d.tickets;
    weeks.set(monday, w);
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    weekly: true,
    points: [...weeks.entries()].map(([day, w]) => ({
      day,
      foodTTC: r2(w.food),
      drinkTTC: r2(w.drink),
      totalTTC: r2(w.food + w.drink),
      tickets: w.tickets,
      label: fmt(day, { day: "numeric", month: "short" }),
      title: `Semaine du ${fmt(day, { day: "numeric", month: "long" })}`,
    })),
  };
};

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
    <div className="min-w-44 rounded-lg border bg-background px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium capitalize text-foreground">{point.title}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-[2px] bg-sales-food" aria-hidden />
          Repas
        </dt>
        <dd className="text-right tabular-nums text-foreground">{formatCurrency(point.foodTTC)}</dd>
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-[2px] bg-sales-drink" aria-hidden />
          Boissons
        </dt>
        <dd className="text-right tabular-nums text-foreground">{formatCurrency(point.drinkTTC)}</dd>
        <dt className="border-t pt-1 font-medium text-foreground">Total TTC</dt>
        <dd className="border-t pt-1 text-right font-semibold tabular-nums text-foreground">
          {formatCurrency(point.totalTTC)}
        </dd>
        <dt className="text-muted-foreground">Tickets</dt>
        <dd className="text-right tabular-nums text-foreground">{point.tickets}</dd>
      </dl>
    </div>
  );
}

export function DailySalesChart({ daily }: { readonly daily: readonly DailyPoint[] }) {
  const { points, weekly } = toPoints(daily);
  const withSales = points.filter((p) => p.totalTTC > 0);
  const average = withSales.length
    ? withSales.reduce((s, p) => s + p.totalTTC, 0) / withSales.length
    : 0;
  const peakIndex = points.reduce(
    (best, p, i) => (p.totalTTC > (points[best]?.totalTTC ?? 0) ? i : best),
    0,
  );

  const unit = weekly ? "semaine" : "jour";
  const totals = points.reduce(
    (t, p) => ({
      food: t.food + p.foodTTC,
      drink: t.drink + p.drinkTTC,
      tickets: t.tickets + p.tickets,
    }),
    { food: 0, drink: 0, tickets: 0 },
  );

  // Only the best bar carries its value: a number on every bar is noise.
  const peakLabel = (props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    index?: number;
  }): React.ReactElement => {
    const peak = points[peakIndex];
    if (props.index !== peakIndex || !peak || peak.totalTTC === 0) return <g />;
    const x = Number(props.x ?? 0) + Number(props.width ?? 0) / 2;
    const y = Number(props.y ?? 0) - 8;
    return (
      <text x={x} y={y} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
        {formatEuroShort(peak.totalTTC)}
      </text>
    );
  };

  return (
    <ChartCard
      title={`Chiffre d'affaires par ${unit}`}
      description={`Repas et boissons empilés, en euros TTC. La ligne pointillée donne la moyenne par ${unit} travaillé${weekly ? "e" : ""}.`}
      legend={[
        { label: "Repas", swatch: "bg-sales-food" },
        { label: "Boissons", swatch: "bg-sales-drink" },
      ]}
      chart={
        withSales.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Aucune vente sur la période.
          </p>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
            <BarChart data={points} margin={{ left: 0, right: 96, top: 24, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} strokeDasharray="0" />
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
              <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<DailyTooltip />} />
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
              <Bar dataKey="foodTTC" stackId="ca" fill="var(--color-foodTTC)" maxBarSize={24} />
              <Bar
                dataKey="drinkTTC"
                stackId="ca"
                fill="var(--color-drinkTTC)"
                stroke="var(--card)"
                strokeWidth={2}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              >
                <LabelList dataKey="totalTTC" content={peakLabel} />
              </Bar>
            </BarChart>
          </ChartContainer>
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
            <span key="d" className="capitalize">{p.title}</span>,
            formatCurrency(p.foodTTC),
            formatCurrency(p.drinkTTC),
            formatCurrency(p.totalTTC),
            p.tickets,
          ])}
          footer={[
            "Total",
            formatCurrency(totals.food),
            formatCurrency(totals.drink),
            formatCurrency(totals.food + totals.drink),
            totals.tickets,
          ]}
        />
      }
    />
  );
}
