"use client";

import { PrinterIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { recordReceiptReprintAction } from "@/actions/order.actions";
import { Button } from "@/components/ui/button";

/**
 * Prints the receipt. On a duplicate it first records the reprint, so the
 * next copy carries the next number and every duplicate stays traceable.
 */
export function ReceiptPrintButton({
  orderId,
  duplicate,
}: {
  readonly orderId: string;
  readonly duplicate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const print = () => {
    if (!duplicate) {
      window.print();
      return;
    }
    startTransition(async () => {
      await recordReceiptReprintAction({ orderId });
      window.print();
      router.refresh();
    });
  };

  return (
    <Button onClick={print} disabled={pending} className="print:hidden">
      <PrinterIcon className="size-4" aria-hidden />
      {duplicate ? "Imprimer le duplicata" : "Imprimer"}
    </Button>
  );
}
