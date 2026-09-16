"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartCard, DataTable } from "@/components/sales/chart-card";
import { ChartStory, readIndex, useChartStory } from "@/components/sales/chart-story";
import { formatEuroShort, formatPercent } from "@/components/sales/sales-labels";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { formatCurrency, TIME_ZONE } from "@/lib/format";
import type { MarginDay, MarginTotals } from "@/lib/profit";

const config = {
  materialCost: { label: "Coût matière", color: "var(--sales-takeaway)" },
  margin: { label: "Marge", color: "var(--sales-delivery)" },
} satisfies ChartConfig;

const fmt = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: TIME_ZONE, ...options });

/**
 * Each column is a day's revenue split in two: what the ingredients cost, and
 * what stayed. The sentence above says it in words, for the whole period or
 * for the day being pointed at.
 */
export function MarginDailyChart({
  daily,
  totals,
}: {
  readonly daily: readonly MarginDay[];
  readonly totals: MarginTotals;
}) {
  const story = useChartStory(daily.length);
  const reducedMotion = usePrefersReducedMotion();

  const points = daily.map((d) => ({
    ...d,
    label: daily.length <= 14 ? fmt(d.day, { weekday: "short", day: "numeric" }) : fmt(d.day, { day: "2-digit", month: "2-digit" }),
    title: fmt(d.day, { weekday: "long", day: "numeric", month: "long" }),
  }));
  const sellingDays = points.filter((p) => p.revenueHT > 0);
  const best = points.reduce((top, p) => (p.margin > top.margin ? p : top), points[0]);

  const point = story.active != null ? points[story.active] : null;
  const dayRatio = point && point.revenueHT > 0 ? (point.materialCost / point.revenueHT) * 100 : null;
  const parts = point
    ? [
        { label: "vendu HT", value: formatCurrency(point.revenueHT) },
        { label: "de matière", value: formatCurrency(point.materialCost), swatch: "bg-sales-takeaway" },
        { label: "de marge", value: formatCurrency(point.margin), swatch: "bg-sales-delivery" },
        ...(dayRatio != null ? [{ label: "ratio matière", value: formatPercent(dayRatio, 0) }] : []),
      ]
    : [
        { label: "vendu HT", value: formatCurrency(totals.revenueHT) },
        { label: "de matière", value: formatCurrency(totals.materialCost), swatch: "bg-sales-takeaway" },
        { label: "de marge", value: formatCurrency(totals.margin), swatch: "bg-sales-delivery" },
        ...(totals.ratio != null ? [{ label: "ratio matière", value: formatPercent(totals.ratio) }] : []),
      ];

  return (
    <ChartCard
      title="Jour par jour"
      description="Chaque colonne est une journée de vente : en bas ce que la matière a coûté, au-dessus ce qu'il vous reste."
      legend={[
        { label: "Coût matière", swatch: "bg-sales-takeaway" },
        { label: "Marge", swatch: "bg-sales-delivery" },
      ]}
      story={
        sellingDays.length > 0 ? (
          <ChartStory
            lead={point ? point.title : `${sellingDays.length} jour${sellingDays.length > 1 ? "s" : ""} de vente`}
            parts={parts}
            note={
              point
                ? point.revenueHT === 0
                  ? "Aucune vente ce jour-là."
                  : undefined
                : best && best.margin > 0
                  ? `Meilleure marge : ${best.title}, ${formatCurrency(best.margin)}.`
                  : undefined
            }
            pinned={story.pinned}
          />
        ) : null
      }
      chart={
        sellingDays.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucune vente sur la période.</p>
        ) : (
          <div
            tabIndex={0}
            role="group"
            aria-label="Marge jour par jour : flèches gauche et droite pour parcourir"
            onKeyDown={story.onKeyDown}
            className="rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
              <BarChart
                data={points}
                margin={{ top: 16, right: 8, bottom: 0, left: 0 }}
                barCategoryGap="22%"
                onMouseMove={(state) => story.hover(readIndex(state))}
                onMouseLeave={() => story.hover(null)}
                onClick={(state) => story.pin(readIndex(state))}
              >
                <CartesianGrid vertical={false} strokeOpacity={0.35} />
                <ChartTooltip
                  cursor={{ fill: "var(--muted)" }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="rounded-lg border bg-popover p-2 text-sm shadow-md">
                        <p className="font-semibold tabular-nums">{formatCurrency(payload[0].payload.margin)} de marge</p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {formatCurrency(payload[0].payload.revenueHT)} vendu · {formatCurrency(payload[0].payload.materialCost)} de matière
                        </p>
                        <p className="text-xs capitalize text-muted-foreground">{payload[0].payload.title}</p>
                      </div>
                    ) : null
                  }
                />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tickMargin={8} interval="preserveStartEnd" minTickGap={18} />
                <YAxis tickFormatter={formatEuroShort} tickLine={false} axisLine={false} width={64} tickCount={5} />
                <Bar
                  dataKey="materialCost"
                  stackId="j"
                  fill="var(--color-materialCost)"
                  maxBarSize={24}
                  isAnimationActive={!reducedMotion}
                />
                <Bar
                  dataKey="margin"
                  stackId="j"
                  stroke="var(--card)"
                  strokeWidth={2}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                  fill="var(--color-margin)"
                  isAnimationActive={!reducedMotion}
                />
              </BarChart>
            </ChartContainer>
          </div>
        )
      }
      table={
        <DataTable
          headers={[
            { label: "Jour" },
            { label: "Vendu HT", numeric: true },
            { label: "Matière", numeric: true },
            { label: "Marge", numeric: true },
          ]}
          rows={points.map((p) => [
            <span key="d" className="capitalize">
              {p.title}
            </span>,
            formatCurrency(p.revenueHT),
            formatCurrency(p.materialCost),
            formatCurrency(p.margin),
          ])}
          footer={["Total", formatCurrency(totals.revenueHT), formatCurrency(totals.materialCost), formatCurrency(totals.margin)]}
        />
      }
    />
  );
}
