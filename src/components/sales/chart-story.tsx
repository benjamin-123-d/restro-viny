"use client";

import { PinIcon } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

/**
 * The sentence above a chart, and the small machine that drives it.
 *
 * A chart answers a question; the reader should not have to translate bars
 * into words. So every chart carries one line of plain French that says what
 * the whole period did — and, the moment the reader points at a bar, says what
 * that bar did instead. Pointer, touch and keyboard all drive the same line,
 * and it is announced to screen readers, so nothing is reachable by hover only.
 */

export interface StoryPart {
  readonly label: string;
  readonly value: string;
  /** Swatch class of the series this part belongs to, when it has one. */
  readonly swatch?: string;
}

export interface StoryState {
  /** Index under the pointer, or pinned by click / keyboard; null for the summary. */
  readonly active: number | null;
  readonly pinned: boolean;
  readonly hover: (index: number | null) => void;
  readonly pin: (index: number | null) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  /** Dim marks that are not the active one, once something is active. */
  readonly opacityOf: (index: number) => number;
}

export function useChartStory(count: number): StoryState {
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const active = pinnedIndex ?? hovered;

  const move = (delta: number) => {
    const from = active ?? (delta > 0 ? -1 : count);
    const next = Math.min(Math.max(from + delta, 0), Math.max(count - 1, 0));
    setPinnedIndex(next);
  };

  return {
    active: count > 0 ? active : null,
    pinned: pinnedIndex != null,
    hover: (index) => setHovered(index),
    pin: (index) => setPinnedIndex((current) => (current === index ? null : index)),
    onKeyDown: (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        setPinnedIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setPinnedIndex(Math.max(count - 1, 0));
      } else if (event.key === "Escape") {
        setPinnedIndex(null);
        setHovered(null);
      }
    },
    opacityOf: (index) => (active == null || active === index ? 1 : 0.35),
  };
}

/**
 * Values lead, labels follow: the figure is the strong ink, the word beside it
 * is muted, and the series colour rides a swatch rather than the text.
 */
export function ChartStory({
  lead,
  parts,
  note,
  pinned,
  interactive = true,
}: {
  readonly lead: string;
  readonly parts: readonly StoryPart[];
  readonly note?: string;
  readonly pinned?: boolean;
  readonly interactive?: boolean;
}) {
  return (
    <div
      aria-live="polite"
      className="flex min-h-[4.5rem] flex-col gap-1.5 rounded-lg bg-muted/40 px-3 py-2.5 transition-colors"
    >
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
        <span className="first-letter:uppercase">{lead}</span>
        {pinned ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <PinIcon className="size-3" aria-hidden />
            épinglé · Échap pour libérer
          </span>
        ) : null}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {parts.map((part) => (
          <span key={part.label} className="flex items-baseline gap-1.5">
            {part.swatch ? (
              <span className={cn("inline-block size-2.5 translate-y-[-1px] rounded-[3px]", part.swatch)} aria-hidden />
            ) : null}
            <span className="text-base font-semibold text-foreground">{part.value}</span>
            <span className="text-xs text-muted-foreground">{part.label}</span>
          </span>
        ))}
      </p>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      {interactive ? (
        <p className="text-xs text-muted-foreground print:hidden">
          Survolez ou touchez une barre · flèches ← → au clavier
        </p>
      ) : null}
    </div>
  );
}

/**
 * recharts hands the active index back as a number, a string, or null
 * depending on the chart; this is the one place that has to know.
 */
export const readIndex = (state: { activeTooltipIndex?: number | string | null } | undefined): number | null => {
  const raw = state?.activeTooltipIndex;
  if (raw == null) return null;
  const index = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(index) ? index : null;
};
