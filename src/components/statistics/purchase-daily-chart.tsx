"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, XAxis, YAxis } from "recharts";

import { ChartCard, DataTable } from "@/components/sales/chart-card";
import { ChartStory, readIndex, useChartStory } from "@/components/sales/chart-story";
import { formatEuroShort, formatPercent } from "@/components/sales/sales-labels";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { formatCurrency, TIME_ZONE } from "@/lib/format";
import type { PurchaseDayPoint } from "@/services/purchase-analytics.service";

const config = {
  amountHT: { label: "Achats HT", color: "var(--sales-takeaway)" },
} satisfies ChartConfig;

const fmt = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: TIME_ZONE, ...options });

/**
 * Buying comes in bursts — a delivery, then nothing for three days — so the
 * chart leads with the sentence: what the whole period cost, and what the day
 * under the pointer cost.
 */
export function PurchaseDailyChart({
  daily,
  totalHT,
  documents,
}: {
  readonly daily: readonly PurchaseDayPoint[];
  readonly totalHT: number;
  readonly documents: number;
}) {
  const story = useChartStory(daily.length);
  const reducedMotion = usePrefersReducedMotion();

  const peakIndex = daily.reduce((best, d, i) => (d.amountHT > (daily[best]?.amountHT ?? 0) ? i : best), 0);
  const points = daily.map((d, i) => ({
    ...d,
    label: daily.length <= 14 ? fmt(d.day, { weekday: "short", day: "numeric" }) : fmt(d.day, { day: "2-digit", month: "2-digit" }),
    title: fmt(d.day, { weekday: "long", day: "numeric", month: "long" }),
    peakValue: i === peakIndex && d.amountHT > 0 ? d.amountHT : null,
  }));
  const buyingDays = points.filter((p) => p.amountHT !== 0);
  const average = buyingDays.length ? totalHT / buyingDays.length : 0;
  const peak = points[peakIndex];

  const point = story.active != null ? points[story.active] : null;
  const parts = point
    ? [
        { label: "acheté HT", value: formatCurrency(point.amountHT) },
        ...(totalHT > 0 ? [{ label: "de la période", value: formatPercent((point.amountHT / totalHT) * 100, 0) }] : []),
      ]
    : [
        { label: "acheté HT", value: formatCurrency(totalHT) },
        { label: documents > 1 ? "documents" : "document", value: String(documents) },
        { label: "par jour d'achat", value: formatCurrency(average) },
      ];

  return (
    <ChartCard
      title="Achats jour par jour"
      description="Ce qui a été facturé chaque jour, HT. Les achats arrivent par à-coups : ce sont les livraisons."
      legend={[{ label: "Achats HT", swatch: "bg-sales-takeaway" }]}
      story={
        points.length > 0 ? (
          <ChartStory
            lead={point ? point.title : `${buyingDays.length} jour${buyingDays.length > 1 ? "s" : ""} d'achat`}
            parts={parts}
            note={
              point
                ? point.amountHT === 0
                  ? "Rien acheté ce jour-là."
                  : undefined
                : peak && peak.amountHT > 0
                  ? `Plus gros jour : ${peak.title}, ${formatCurrency(peak.amountHT)}.`
                  : undefined
            }
            pinned={story.pinned}
          />
        ) : null
      }
      chart={
        points.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun achat sur la période.</p>
        ) : (
          <div
            tabIndex={0}
            role="group"
            aria-label="Achats jour par jour : flèches gauche et droite pour parcourir"
            onKeyDown={story.onKeyDown}
            className="rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
              <BarChart
                data={points}
                margin={{ top: 28, right: 96, bottom: 0, left: 0 }}
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
                        <p className="font-semibold tabular-nums">{formatCurrency(Number(payload[0].value ?? 0))} HT</p>
                        <p className="text-xs capitalize text-muted-foreground">{payload[0].payload.title}</p>
                      </div>
                    ) : null
                  }
                />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tickMargin={8} interval="preserveStartEnd" minTickGap={18} />
                <YAxis tickFormatter={formatEuroShort} tickLine={false} axisLine={false} width={64} tickCount={5} />
                {average > 0 ? (
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
                ) : null}
                <Bar
                  dataKey="amountHT"
                  fill="var(--color-amountHT)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
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
          headers={[{ label: "Jour" }, { label: "Acheté HT", numeric: true }]}
          rows={points.map((p) => [
            <span key="d" className="capitalize">
              {p.title}
            </span>,
            formatCurrency(p.amountHT),
          ])}
          footer={["Total", formatCurrency(totalHT)]}
        />
      }
    />
  );
}
