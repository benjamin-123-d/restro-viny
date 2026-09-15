import { CameraIcon, ListIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The two ways to record a supplier document: import it and type the total,
 * or copy every line. Plain links, so the choice survives a page reload.
 */
export function EntryModeSwitch({
  basePath,
  mode,
}: {
  readonly basePath: string;
  readonly mode: "quick" | "detail";
}) {
  const options = [
    {
      key: "quick",
      href: basePath,
      icon: CameraIcon,
      title: "Import rapide",
      text: "Le PDF ou la photo, et juste le total.",
    },
    {
      key: "detail",
      href: `${basePath}?mode=detail`,
      icon: ListIcon,
      title: "Saisie détaillée",
      text: "Chaque ligne, pour suivre les prix et le stock.",
    },
  ] as const;

  return (
    <nav aria-label="Mode de saisie" className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <Link
          key={o.key}
          href={o.href}
          aria-current={mode === o.key ? "page" : undefined}
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3 transition-colors",
            mode === o.key ? "border-foreground bg-muted" : "hover:bg-muted/50",
          )}
        >
          <o.icon className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            <span className="block text-sm font-semibold">{o.title}</span>
            <span className="block text-xs text-muted-foreground">{o.text}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
