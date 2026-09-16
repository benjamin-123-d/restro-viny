"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  InfoIcon,
  LightbulbIcon,
  SparklesIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import {
  actionableCount,
  type Recommendation,
  type RecommendationTone,
} from "@/lib/recommendations";
import { cn } from "@/lib/utils";

interface ToneStyle {
  readonly label: string;
  readonly Icon: LucideIcon;
  /** Left rule + tint of the card. */
  readonly card: string;
  readonly icon: string;
  readonly chip: string;
}

/**
 * Tone is carried by an icon and a word as well as by colour — a kitchen
 * screen is read at arm's length, often by someone who reads colour poorly.
 */
const TONE: Readonly<Record<RecommendationTone, ToneStyle>> = {
  attention: {
    label: "À traiter",
    Icon: TriangleAlertIcon,
    card: "border-amber-500/40 bg-amber-500/5",
    icon: "text-amber-600 dark:text-amber-400",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  info: {
    label: "À savoir",
    Icon: InfoIcon,
    card: "border-border bg-muted/30",
    icon: "text-muted-foreground",
    chip: "bg-muted text-muted-foreground",
  },
  bravo: {
    label: "Bonne nouvelle",
    Icon: SparklesIcon,
    card: "border-emerald-500/40 bg-emerald-500/5",
    icon: "text-emerald-600 dark:text-emerald-400",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
};

function RecommendationCard({ item }: { readonly item: Recommendation }) {
  const tone = TONE[item.tone];
  return (
    <li className={cn("rounded-xl border p-3", tone.card)}>
      <div className="flex items-start gap-2.5">
        <tone.Icon className={cn("mt-0.5 size-4 shrink-0", tone.icon)} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-heading text-sm font-medium">{item.title}</p>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[0.6875rem] font-medium",
                tone.chip,
              )}
            >
              {tone.label}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {item.detail}
          </p>
          {item.href ? (
            <Link
              href={item.href}
              className="text-primary mt-2 inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              Ouvrir
              <span className="sr-only"> : {item.title}</span>
              <ArrowRightIcon className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * La lampe : a round button pinned to the bottom-right corner of the manager
 * space. One tap opens the advice of the moment. It carries a count of what
 * actually needs doing, so the owner can ignore it with confidence when it is
 * quiet — a lamp that always looks urgent gets ignored when it matters.
 */
export function RecommendationLamp({
  recommendations,
}: {
  readonly recommendations: readonly Recommendation[];
}) {
  const [open, setOpen] = useState(false);
  const calm = usePrefersReducedMotion();
  const toActOn = actionableCount(recommendations);

  return (
    <>
      <Button
        type="button"
        size="icon-lg"
        // Stays clear of the page content, and rides above the staff tab bar
        // on a phone so it never covers a thumb target.
        className={cn(
          "fixed right-6 bottom-6 z-40 size-12 rounded-full shadow-lg",
          "max-sm:bottom-[calc(5.5rem+env(safe-area-inset-bottom))]",
          // The glow only breathes for people who did not ask for calm.
          !calm && toActOn > 0 && "animate-pulse",
        )}
        aria-label={
          toActOn > 0
            ? `Recommandations : ${toActOn} à traiter`
            : "Recommandations"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <LightbulbIcon className="size-5" aria-hidden />
        {toActOn > 0 ? (
          <span
            aria-hidden
            className="bg-destructive text-background absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full text-[0.6875rem] font-semibold tabular-nums shadow"
          >
            {toActOn}
          </span>
        ) : null}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[88vw] overflow-y-auto sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <LightbulbIcon className="size-4" aria-hidden />
              Recommandations
            </SheetTitle>
            <SheetDescription>
              {toActOn > 0
                ? `${toActOn} point${toActOn > 1 ? "s" : ""} à traiter aujourd'hui.`
                : "Rien d'urgent pour le moment."}
            </SheetDescription>
          </SheetHeader>
          {recommendations.length === 0 ? (
            // The rules always return something; this is only a safety net so
            // the panel can never open on a blank screen.
            <p className="text-muted-foreground px-4 pb-6 text-sm">
              Pas encore assez de données pour vous conseiller : encaissez
              quelques tickets et revenez voir.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5 px-4 pb-6">
              {recommendations.map((item) => (
                <RecommendationCard key={item.id} item={item} />
              ))}
            </ul>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
