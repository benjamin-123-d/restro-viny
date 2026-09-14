"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { humanError } from "@/lib/error-messages";
import type { ActionResult } from "@/types";

/**
 * The buttons on a document row — Validate, Cancel, Delete. Each is shown only
 * when it makes sense for the document's status, so an owner is never offered
 * an action that would just fail.
 */

export interface DocAction {
  readonly label: string;
  readonly action: (input: { id: string }) => Promise<ActionResult<unknown>>;
  readonly tone?: "primary" | "danger" | "neutral";
  /** Asked before running; skip for harmless actions. */
  readonly confirm?: string;
}

const TONE: Readonly<Record<NonNullable<DocAction["tone"]>, string>> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-800",
  danger: "border border-red-200 text-red-700 hover:bg-red-50",
  neutral: "border text-zinc-700 hover:bg-zinc-50",
};

export const DocActions = ({
  id,
  actions,
}: {
  id: string;
  actions: readonly DocAction[];
}) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (actions.length === 0) return null;

  const run = (item: DocAction) => {
    if (item.confirm && !window.confirm(item.confirm)) return;
    setError(null);
    startTransition(async () => {
      const result = await item.action({ id });
      if (!result.success) {
        setError(humanError(result.error));
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        {actions.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => run(item)}
            disabled={pending}
            className={`whitespace-nowrap rounded px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${
              TONE[item.tone ?? "neutral"]
            }`}
          >
            {pending ? "…" : item.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="max-w-56 text-right text-xs text-red-600">{error}</p>
      )}
    </div>
  );
};

/** The "+ New" button that sits in a list page header. */
export const NewButton = ({ href, label }: { href: string; label: string }) => (
  <a
    href={href}
    className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
  >
    <span aria-hidden className="text-base leading-none">
      +
    </span>
    {label}
  </a>
);
