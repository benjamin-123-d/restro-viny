"use client";

import { Volume2Icon, VolumeXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Speaker on/off control for French voice announcements. Hidden when the
 *  browser has no speech engine. */
export function SoundToggle({
  supported,
  enabled,
  onToggle,
}: {
  readonly supported: boolean;
  readonly enabled: boolean;
  readonly onToggle: () => void;
}) {
  if (!supported) {
    return null;
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={enabled ? "Couper les annonces vocales" : "Activer les annonces vocales"}
      aria-pressed={enabled}
      onClick={onToggle}
    >
      {enabled ? (
        <Volume2Icon className="size-4" />
      ) : (
        <VolumeXIcon className="text-muted-foreground size-4" />
      )}
    </Button>
  );
}
