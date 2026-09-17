"use client";

import { CheckIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { upsertAccountAction } from "@/actions/accounting-encoding.actions";
import { Input } from "@/components/ui/input";
import { humanError } from "@/lib/error-messages";
import { isAccountCode } from "@/lib/chart-of-accounts";
import { cn } from "@/lib/utils";

export interface AccountOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/**
 * The COMPTE cell: type a number, pick it, create it, or rename it — without
 * leaving the entry.
 *
 * Creating an account mid-entry is not a convenience, it is the way accountants
 * work: the plan comptable grows as the invoices arrive, and an accountant made
 * to leave for a settings screen will type the nearest wrong account instead.
 */
export function AccountCombobox({
  value,
  accounts,
  onChange,
  onAccountsChanged,
  disabled,
}: {
  readonly value: string;
  readonly accounts: readonly AccountOption[];
  readonly onChange: (code: string, name: string) => void;
  readonly onAccountsChanged: (account: AccountOption) => void;
  readonly disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [saving, startSaving] = useTransition();

  const selected = accounts.find((account) => account.code === value);
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? accounts.filter(
        (account) => account.code.startsWith(needle) || account.name.toLowerCase().includes(needle),
      )
    : accounts;
  const exact = accounts.some((account) => account.code === query.trim());
  const canCreate = isAccountCode(query.trim()) && !exact;

  const commit = (code: string, name: string) =>
    startSaving(async () => {
      const result = await upsertAccountAction({ code, name });
      if (!result.success || !result.data) {
        toast.error(humanError(result.error));
        return;
      }
      onAccountsChanged(result.data);
      onChange(result.data.code, result.data.name);
      setOpen(false);
      setRenaming(false);
      setQuery("");
    });

  if (renaming && selected) {
    return (
      <span className="flex items-center gap-1">
        <Input
          autoFocus
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit(selected.code, draftName);
            if (event.key === "Escape") setRenaming(false);
          }}
          className="h-9"
          aria-label={`Renommer le compte ${selected.code}`}
        />
        <button
          type="button"
          onClick={() => commit(selected.code, draftName)}
          disabled={saving}
          className="text-primary rounded-md p-1.5 hover:bg-muted"
          aria-label="Enregistrer le libellé"
        >
          <CheckIcon className="size-4" />
        </button>
      </span>
    );
  }

  if (!open) {
    return (
      <span className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen(true);
            setQuery("");
          }}
          className="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-left text-sm disabled:opacity-60"
        >
          <span className="block font-medium tabular-nums">{selected?.code ?? value ?? "—"}</span>
          <span className="text-muted-foreground block truncate text-xs">{selected?.name ?? "compte inconnu"}</span>
        </button>
        {selected && !disabled ? (
          <button
            type="button"
            onClick={() => {
              setDraftName(selected.name);
              setRenaming(true);
            }}
            className="text-muted-foreground rounded-md p-1.5 hover:bg-muted"
            aria-label={`Changer le libellé de ${selected.code}`}
            title="Changer le libellé"
          >
            <PencilIcon className="size-3.5" />
          </button>
        ) : null}
      </span>
    );
  }

  return (
    <span className="relative block">
      <Input
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter") {
            event.preventDefault();
            if (matches[0] && !canCreate) {
              onChange(matches[0].code, matches[0].name);
              setOpen(false);
            } else if (canCreate) {
              commit(query.trim(), "");
            }
          }
        }}
        placeholder="Numéro ou libellé…"
        className="h-9"
        inputMode="numeric"
        aria-label="Chercher un compte"
      />

      <span className="bg-card absolute top-full left-0 z-30 mt-1 flex max-h-64 w-72 flex-col overflow-y-auto rounded-lg border shadow-lg">
        {canCreate ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => commit(query.trim(), "")}
            disabled={saving}
            className="text-primary flex items-center gap-2 border-b px-2.5 py-2 text-left text-sm font-medium hover:bg-muted"
          >
            <PlusIcon className="size-4" aria-hidden />
            Créer le compte {query.trim()}
          </button>
        ) : null}

        {matches.slice(0, 60).map((account) => (
          <button
            key={account.id}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange(account.code, account.name);
              setOpen(false);
            }}
            className={cn(
              "px-2.5 py-1.5 text-left text-sm hover:bg-muted",
              account.code === value && "bg-accent text-accent-foreground",
            )}
          >
            <span className="font-medium tabular-nums">{account.code}</span>
            <span className="text-muted-foreground block truncate text-xs">{account.name}</span>
          </button>
        ))}

        {matches.length === 0 && !canCreate ? (
          <span className="text-muted-foreground px-2.5 py-3 text-sm">
            Aucun compte. Tapez un numéro de trois à huit chiffres pour le créer.
          </span>
        ) : null}
      </span>
    </span>
  );
}
