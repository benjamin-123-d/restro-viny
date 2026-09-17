"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardTrendPoint } from "@/types/dashboard";

const RANGES = [
  { key: "7", label: "7 jours", days: 7 },
  { key: "14", label: "14 jours", days: 14 },
  { key: "30", label: "30 jours", days: 30 },
] as const;

const config = {
  sales: { label: "Ventes", color: "var(--chart-1)" },
} satisfies ChartConfig;

const euroShort = (value: number): string =>
  value >= 1000 ? `${Math.round(value / 100) / 10} k` : String(Math.round(value));

/**
 * The month's shape, and how much of it you want to look at.
 *
 * The tabs really filter the series rather than decorate the card: a dashboard
 * that offers « daily / weekly / monthly » and draws the same line every time
 * teaches the owner to distrust the whole screen.
 */
export function TrendPanel({ data }: { readonly data: readonly DashboardTrendPoint[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30");
  const days = RANGES.find((one) => one.key === range)?.days ?? 30;
  const points = data.slice(-days);
  const best = points.reduce<DashboardTrendPoint | null>(
    (top, point) => (top === null || point.sales > top.sales ? point : top),
    null,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {best && best.sales > 0 ? (
            <>
              Meilleure journée : <strong className="text-foreground">{best.label}</strong> avec{" "}
              <strong className="text-foreground">{formatCurrency(best.sales)}</strong>.
            </>
          ) : (
            "Aucune vente encaissée sur la période."
          )}
        </p>
        <nav aria-label="Période du graphique" className="bg-muted/60 flex rounded-lg p-0.5">
          {RANGES.map((one) => (
            <button
              key={one.key}
              type="button"
              onClick={() => setRange(one.key)}
              aria-pressed={range === one.key}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                range === one.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {one.label}
            </button>
          ))}
        </nav>
      </div>

      <ChartContainer config={config} className="h-[240px] w-full">
        <AreaChart data={points as DashboardTrendPoint[]} margin={{ left: 4, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(value: number) => euroShort(value)}
          />
          <ChartTooltip
            content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />}
          />
          <Area
            dataKey="sales"
            type="monotone"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#trendFill)"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
