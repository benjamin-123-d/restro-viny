"use client";

import { useState } from "react";

import { toast } from "sonner";

import { setSelfOrderEnabledAction } from "@/actions/settings.actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useServerAction } from "@/hooks/use-server-action";

export function SelfOrderCard({
  enabled,
  username,
}: {
  readonly enabled: boolean;
  readonly username: string;
}) {
  const [checked, setChecked] = useState(enabled);

  const save = useServerAction(setSelfOrderEnabledAction, {
    refresh: true,
    onSuccess: () => toast.success("Commande en ligne mise à jour"),
    onError: (message) => {
      setChecked((prev) => !prev);
      toast.error(message);
    },
  });

  const onToggle = (next: boolean) => {
    setChecked(next);
    save.execute({ enabled: next });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commande par les clients (QR code)</CardTitle>
        <CardDescription>
          Les clients à table scannent un QR code et commandent depuis leur téléphone. Les commandes partent
          directement en cuisine et s&apos;ajoutent à la note de la table.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="self-order" className="text-sm font-medium">
            {checked ? "Activée" : "Désactivée"}
          </label>
          <Switch
            id="self-order"
            checked={checked}
            disabled={save.isPending}
            onCheckedChange={onToggle}
          />
        </div>
        <FieldDescription>
          Each table&apos;s QR links to{" "}
          <span className="font-mono">/order/{username}?table=…</span>. Guests
          verify their phone with a one-time code before their first order.
        </FieldDescription>
      </CardContent>
    </Card>
  );
}
