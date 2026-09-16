import Link from "next/link";

import { cn } from "@/lib/utils";
import { PERIODS } from "@/lib/sales-periods";

/**
 * The same six periods on every statistics screen, so moving from Ventes to
 * Achats to Bénéfices keeps the question ("over what window?") answered the
 * same way.
 */
export function PeriodFilter({
  active,
  basePath,
}: {
  readonly active: string;
  readonly basePath: string;
}) {
  return (
    <nav aria-label="Période" className="flex flex-wrap gap-1.5 print:hidden">
      {PERIODS.map((p) => (
        <Link
          key={p.key}
          href={`${basePath}?periode=${p.key}`}
          aria-current={p.key === active ? "page" : undefined}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            p.key === active
              ? "border-foreground bg-foreground text-background"
              : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
