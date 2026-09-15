import { CheckCircle2Icon, PencilIcon, SparklesIcon } from "lucide-react";

import type { RecipeReliability } from "@/lib/food-cost";
import { cn } from "@/lib/utils";

const STYLE: Readonly<Record<RecipeReliability, { label: string; className: string; Icon: typeof SparklesIcon }>> = {
  ESTIMATED: {
    label: "Estimée",
    className: "bg-orange-100 text-orange-900 ring-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:ring-orange-800",
    Icon: SparklesIcon,
  },
  ADJUSTED: {
    label: "Ajustée",
    className: "bg-blue-100 text-blue-900 ring-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-800",
    Icon: PencilIcon,
  },
  VERIFIED: {
    label: "Vérifiée",
    className: "bg-green-100 text-green-900 ring-green-300 dark:bg-green-950 dark:text-green-200 dark:ring-green-800",
    Icon: CheckCircle2Icon,
  },
};

/** Orange / blue / green pill — always with its icon and word, never colour alone. */
export function ReliabilityBadge({
  reliability,
  className,
}: {
  readonly reliability: RecipeReliability;
  readonly className?: string;
}) {
  const { label, className: tone, Icon } = STYLE[reliability];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1",
        tone,
        className,
      )}
      title={
        reliability === "ESTIMATED"
          ? "Proposée par le catalogue : à corriger ou à peser"
          : reliability === "ADJUSTED"
            ? "Corrigée par vous"
            : "Pesée au moins une fois"
      }
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}
