"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createOrderFromQuotationAction } from "@/actions/purchasing-sourcing.actions";
import { Button } from "@/components/ui/button";
import { humanError } from "@/lib/error-messages";

/** Turn an accepted quote straight into a purchase order at its prices. */
export function QuotationOrderButton({ quotationId }: { readonly quotationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await createOrderFromQuotationAction({ quotationId });
            if (!result.success) {
              setError(humanError(result.error));
              return;
            }
            router.push("/dashboard/purchasing/orders");
          })
        }
      >
        {pending ? "Création…" : "Passer commande"}
      </Button>
      {error ? <p className="max-w-60 text-right text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
