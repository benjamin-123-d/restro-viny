"use client";

import { ChartColumnIcon, TableIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface LegendEntry {
  readonly label: string;
  /** Tailwind background class of the swatch. */
  readonly swatch: string;
}

/**
 * The frame every sales chart sits in: title, one-line reading guide, legend,
 * and a switch to the same figures as a table — so no number on the page is
 * only reachable through colour or hover.
 */
export function ChartCard({
  title,
  description,
  legend,
  story,
  chart,
  table,
  className,
}: {
  readonly title: string;
  readonly description?: string;
  readonly legend?: readonly LegendEntry[];
  /** The live sentence that reads the chart out loud, above the marks. */
  readonly story?: ReactNode;
  readonly chart: ReactNode;
  readonly table: ReactNode;
  readonly className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-xl bg-card p-4 text-card-foreground shadow-xs ring-1 ring-foreground/10 sm:p-5",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div
          role="group"
          aria-label="Affichage"
          className="flex shrink-0 rounded-lg bg-muted p-0.5 print:hidden"
        >
          {(
            [
              ["chart", "Graphique", ChartColumnIcon],
              ["table", "Tableau", TableIcon],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                view === key
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </header>

      {legend && legend.length > 0 && view === "chart" ? (
        <ul className="-mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {legend.map((entry) => (
            <li key={entry.label} className="flex items-center gap-1.5">
              <span className={cn("inline-block size-2.5 rounded-[3px]", entry.swatch)} aria-hidden />
              {entry.label}
            </li>
          ))}
        </ul>
      ) : null}

      {story && view === "chart" ? <div className="min-w-0">{story}</div> : null}

      <div className="min-w-0">{view === "chart" ? chart : table}</div>
    </section>
  );
}

/** Compact, right-aligned-numbers table used as every chart's twin. */
export function DataTable({
  headers,
  rows,
  footer,
}: {
  readonly headers: readonly { readonly label: string; readonly numeric?: boolean }[];
  readonly rows: readonly (readonly ReactNode[])[];
  readonly footer?: readonly ReactNode[];
}) {
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur">
          <tr>
            {headers.map((h) => (
              <th
                key={h.label}
                scope="col"
                className={cn(
                  "whitespace-nowrap px-3 py-2 text-xs font-medium text-muted-foreground",
                  h.numeric ? "text-right" : "text-left",
                )}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t">
              {row.map((cell, c) => (
                <td
                  key={c}
                  className={cn(
                    "whitespace-nowrap px-3 py-1.5",
                    headers[c]?.numeric ? "text-right tabular-nums" : "text-left",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer ? (
          <tfoot>
            <tr className="border-t bg-muted/40 font-semibold">
              {footer.map((cell, c) => (
                <td
                  key={c}
                  className={cn(
                    "whitespace-nowrap px-3 py-2",
                    headers[c]?.numeric ? "text-right tabular-nums" : "text-left",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
