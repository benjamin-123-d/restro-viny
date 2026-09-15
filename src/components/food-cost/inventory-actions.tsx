"use client";

import { ClipboardListIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteInventoryAction, openInventoryAction } from "@/actions/food-cost.actions";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { humanError } from "@/lib/error-messages";

export function StartInventoryButton({ label = "Lancer un inventaire" }: { readonly label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await openInventoryAction({});
            if (!result.success || !result.data) {
              toast.error(humanError(result.error));
              return;
            }
            router.push(`/dashboard/food-cost/inventaire/${result.data.id}`);
          })
        }
      >
        <ClipboardListIcon className="size-4" aria-hidden />
        {pending ? "Préparation…" : label}
      </Button>
      <Toaster />
    </>
  );
}

export function DeleteDraftInventoryButton({ id }: { readonly id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Supprimer ce brouillon d'inventaire ?")) return;
        startTransition(async () => {
          const result = await deleteInventoryAction({ id });
          if (!result.success) toast.error(humanError(result.error));
          router.refresh();
        });
      }}
    >
      <Trash2Icon className="size-3.5" aria-hidden />
      Supprimer
    </Button>
  );
}
