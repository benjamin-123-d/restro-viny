"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import {
  regenerateUsernameAction,
  updateUsernameAction,
} from "@/actions/settings.actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useServerAction } from "@/hooks/use-server-action";

const USERNAME_ERRORS: Record<string, string> = {
  USERNAME_TAKEN: "Cet identifiant est déjà pris.",
};

const clean = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);

export function UsernameCard({ username }: { readonly username: string }) {
  const router = useRouter();
  const [value, setValue] = useState(username);
  const [regenerating, setRegenerating] = useState(false);

  const save = useServerAction(updateUsernameAction, {
    refresh: true,
    onSuccess: () => toast.success("Identifiant modifié"),
    onError: (message) => toast.error(USERNAME_ERRORS[message] ?? message),
  });

  const regenerate = async () => {
    setRegenerating(true);
    const result = await regenerateUsernameAction();
    setRegenerating(false);
    if (result.success) {
      setValue(result.data ?? value);
      toast.success("Nouvel identifiant généré");
      router.refresh();
    } else {
      toast.error(result.error ?? "Une erreur est survenue");
    }
  };

  const valid = /^[a-z0-9_]{3,20}$/.test(value);
  const dirty = value !== username;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identifiant</CardTitle>
        <CardDescription>
          L’identifiant unique de votre restaurant, créé automatiquement. Choisissez-en
          un facile à retenir.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="border-input flex flex-1 items-center rounded-md border pl-3 focus-within:ring-[3px] focus-within:ring-ring/50">
            <span className="text-muted-foreground text-sm">@</span>
            <Input
              aria-label="Identifiant"
              value={value}
              onChange={(e) => setValue(clean(e.target.value))}
              className="border-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <Button
            onClick={() => save.execute({ username: value })}
            disabled={save.isPending || !valid || !dirty}
          >
            {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button
            variant="outline"
            onClick={regenerate}
            disabled={regenerating || save.isPending}
          >
            {regenerating ? "Generating…" : "Generate new"}
          </Button>
        </div>
        <FieldDescription className={valid ? "" : "text-destructive"}>
          3–20 lowercase letters, numbers or underscores.
        </FieldDescription>
      </CardContent>
    </Card>
  );
}
