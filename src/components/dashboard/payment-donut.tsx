"use client";

import { Cell, Pie, PieChart } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_MODE_LABEL } from "@/lib/payment-labels";
import type { DashboardPaymentSlice } from "@/types/dashboard";

/** One colour per mode, taken from the validated categorical ramp. */
const COLOURS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const config = { amount: { label: "Encaissé" } } satisfies ChartConfig;

/**
 * Where today's money came in. This is the screen's trust anchor: the slices
 * have to add up to the day's sales, or nothing else on the dashboard is
 * believed either — so the total sits in the middle of the ring, where it is
 * read at the same time as the parts.
 */
export function PaymentDonut({ slices }: { readonly slices: readonly DashboardPaymentSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);
  const data = slices.map((slice) => ({
    ...slice,
    label: PAYMENT_MODE_LABEL[slice.mode] ?? slice.mode,
  }));

  if (total <= 0) {
    return (
      <p className="text-muted-foreground flex h-[220px] items-center justify-center text-center text-sm">
        Rien d&apos;encaissé aujourd&apos;hui.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <ChartContainer config={config} className="mx-auto h-[220px] w-full">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="label" formatter={(value) => formatCurrency(Number(value))} />}
            />
            <Pie data={data} dataKey="amount" nameKey="label" innerRadius={62} outerRadius={92} paddingAngle={2}>
              {data.map((slice, index) => (
                <Cell key={slice.mode} fill={COLOURS[index % COLOURS.length]} stroke="var(--card)" strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-2xl font-semibold tabular-nums">{formatCurrency(total)}</span>
          <span className="text-muted-foreground text-xs">encaissé aujourd&apos;hui</span>
        </span>
      </div>

      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {data.map((slice, index) => (
          <li key={slice.mode} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: COLOURS[index % COLOURS.length] }}
              aria-hidden
            />
            <span className="text-muted-foreground">{slice.label}</span>
            <span className="font-medium tabular-nums">{formatCurrency(slice.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
