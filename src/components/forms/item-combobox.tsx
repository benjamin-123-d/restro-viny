"use client";

import { CheckIcon, ChevronsUpDownIcon, PlusIcon, XIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { saveIngredientAction } from "@/actions/food-cost.actions";
import { FieldHint } from "@/components/forms/help-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerAction } from "@/hooks/use-server-action";
import { humanError } from "@/lib/error-messages";
import { STOCK_UNIT_OPTIONS, UNIT_LABELS } from "@/lib/inventory";
import { hasExactMatch, rankMatches } from "@/lib/search-text";
import { cn } from "@/lib/utils";
import type { StockUnit } from "@/types/inventory";

export interface ComboOption {
  readonly id: string;
  readonly label: string;
  /** Short grey text after the label: unit, pack size, family… */
  readonly hint?: string;
}

export interface CreatedItem extends ComboOption {
  readonly unit: StockUnit;
  readonly purchaseUnit: string | null;
  readonly purchaseFactor: number;
  readonly lastPurchasePrice: number | null;
}

const MAX_SHOWN = 60;

const toNumber = (v: string): number | undefined => {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return v.trim() === "" || Number.isNaN(n) ? undefined : n;
};

/**
 * Type to find an article; when nothing matches, create it right here instead
 * of leaving the form. The new article is selected at once and joins the
 * inventory, the ingredients and every other picker.
 */
export function ItemCombobox({
  options,
  value,
  onChange,
  label = "Article",
  placeholder = "Tapez le nom : tomates, javel, farine…",
  allowCreate = true,
  invalid,
  disabled,
  id: givenId,
  className,
}: {
  readonly options: readonly ComboOption[];
  readonly value: string;
  readonly onChange: (id: string, created?: CreatedItem) => void;
  readonly label?: string;
  readonly placeholder?: string;
  readonly allowCreate?: boolean;
  readonly invalid?: boolean;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly className?: string;
}) {
  const autoId = useId();
  const inputId = givenId ?? `${autoId}-input`;
  const listId = `${autoId}-list`;
  const [created, setCreated] = useState<readonly CreatedItem[]>([]);
  const all = useMemo(() => [...options, ...created.filter((c) => !options.some((o) => o.id === c.id))], [options, created]);
  const selected = all.find((o) => o.id === value);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState<string | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);

  // The list floats above tables that scroll sideways, so it is placed against
  // the window rather than inside its (clipping) parent.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const up = window.innerHeight - rect.bottom < 300 && rect.top > 300;
      setBox({ top: up ? rect.top - 4 : rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 260), up });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const matches = useMemo(() => rankMatches(all, query).slice(0, MAX_SHOWN), [all, query]);
  const canCreate = allowCreate && query.trim().length > 0 && !hasExactMatch(all, query);
  const rowCount = matches.length + (canCreate ? 1 : 0);

  const pick = (option: ComboOption) => {
    onChange(option.id);
    setQuery("");
    setOpen(false);
  };

  const startCreate = () => {
    setCreating(query.trim());
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(rowCount - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      if (active < matches.length) pick(matches[active]);
      else if (canCreate) startCreate();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div ref={anchor} className="relative">
        <Input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={label}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : (selected?.label ?? query)}
          placeholder={selected ? selected.label : placeholder}
          onFocus={() => {
            setQuery("");
            setOpen(true);
            setActive(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={onKeyDown}
          className="h-11 pr-9 text-base"
        />
        <ChevronsUpDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>

      {open && box ? (
        <ul
          id={listId}
          role="listbox"
          style={{ top: box.top, left: box.left, width: box.width, transform: box.up ? "translateY(-100%)" : undefined }}
          className="fixed z-50 max-h-72 overflow-y-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
          onMouseDown={(e) => {
            e.preventDefault();
            if (blurTimer.current) clearTimeout(blurTimer.current);
          }}
        >
          {matches.map((option, index) => (
            <li
              key={option.id}
              role="option"
              aria-selected={option.id === value}
              onClick={() => pick(option)}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-2",
                index === active && "bg-muted",
              )}
            >
              <span className="min-w-0 truncate">
                {option.label}
                {option.hint ? <span className="ml-1.5 text-xs text-muted-foreground">{option.hint}</span> : null}
              </span>
              {option.id === value ? <CheckIcon className="size-4 shrink-0" aria-hidden /> : null}
            </li>
          ))}
          {matches.length === 0 && !canCreate ? (
            <li className="px-2 py-2 text-muted-foreground">Aucun article.</li>
          ) : null}
          {canCreate ? (
            <li
              role="option"
              aria-selected={false}
              onClick={startCreate}
              onMouseEnter={() => setActive(matches.length)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded border-t px-2 py-2 font-medium text-primary",
                active === matches.length && "bg-muted",
              )}
            >
              <PlusIcon className="size-4 shrink-0" aria-hidden />
              Créer l&apos;article « {query.trim()} »
            </li>
          ) : null}
        </ul>
      ) : null}

      {creating != null ? (
        <NewItemPanel
          initialName={creating}
          onCancel={() => setCreating(null)}
          onCreated={(item) => {
            setCreated((list) => [...list, item]);
            setCreating(null);
            setQuery("");
            onChange(item.id, item);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * The few facts an article needs to be counted and costed. Everything past the
 * name and unit is optional and can be completed later in Ingrédients.
 */
function NewItemPanel({
  initialName,
  onCancel,
  onCreated,
}: {
  readonly initialName: string;
  readonly onCancel: () => void;
  readonly onCreated: (item: CreatedItem) => void;
}) {
  const [name, setName] = useState(initialName);
  const [unit, setUnit] = useState<StockUnit>("PIECE");
  const [category, setCategory] = useState("");
  const [purchaseUnit, setPurchaseUnit] = useState("");
  const [factor, setFactor] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const purchaseFactor = toNumber(factor) ?? 1;
  const lastPurchasePrice = toNumber(price);

  const save = useServerAction(saveIngredientAction, {
    refresh: true,
    onSuccess: (data) => {
      if (!data) return;
      onCreated({
        id: data.id,
        label: name.trim(),
        hint: UNIT_LABELS[unit],
        unit,
        purchaseUnit: purchaseUnit.trim() || null,
        purchaseFactor,
        lastPurchasePrice: lastPurchasePrice ?? null,
      });
    },
    onError: (message, fieldErrors) => {
      const first = Object.values(fieldErrors ?? {})[0]?.[0];
      setError(first ?? humanError(message));
    },
  });

  const field = "mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm";

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">Nouvel article</p>
          <p className="text-xs text-muted-foreground">
            Il n&apos;existe pas encore : créez-le ici, il rejoint aussitôt l&apos;inventaire et les ingrédients.
            Seuls le nom et l&apos;unité sont obligatoires, le reste se complète plus tard dans Food cost → Ingrédients.
          </p>
        </div>
        <button type="button" onClick={onCancel} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Annuler la création">
          <XIcon className="size-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="font-medium">Nom</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          <FieldHint>Le nom tel que vous le cherchez : « Crème fraîche 35 % ».</FieldHint>
        </label>
        <label className="block">
          <span className="font-medium">Unité d&apos;usage</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value as StockUnit)} className={field}>
            {STOCK_UNIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldHint>Celle des fiches et du comptage : g pour la farine, ml pour la crème, pièce pour les œufs.</FieldHint>
        </label>
        <label className="block">
          <span className="font-medium">Unité d&apos;achat</span>
          <Input value={purchaseUnit} onChange={(e) => setPurchaseUnit(e.target.value)} className="mt-1" placeholder="carton, panier, bidon…" />
          <FieldHint>Facultatif. Comment vous l&apos;achetez.</FieldHint>
        </label>
        <label className="block">
          <span className="font-medium">Contenance ({UNIT_LABELS[unit]} par unité d&apos;achat)</span>
          <Input value={factor} onChange={(e) => setFactor(e.target.value)} inputMode="decimal" className="mt-1 text-right" placeholder="1" />
          <FieldHint>Exemple : 1 carton = 6 bouteilles, 1 panier = 8 000 g. Vide : 1.</FieldHint>
        </label>
        <label className="block">
          <span className="font-medium">Famille</span>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1" placeholder="Crèmerie, entretien, emballages…" />
          <FieldHint>Facultatif. Sert à ranger et à cibler les comptages.</FieldHint>
        </label>
        <label className="block">
          <span className="font-medium">Prix d&apos;achat HT (€ par unité d&apos;achat)</span>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="mt-1 text-right" placeholder="facultatif" />
          <FieldHint>Si vous le connaissez. Il sera mis à jour au prochain achat.</FieldHint>
        </label>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          type="button"
          disabled={save.isPending || name.trim() === ""}
          onClick={() => {
            setError(null);
            save.execute({
              name: name.trim(),
              unit,
              category: category.trim() || undefined,
              purchaseUnit: purchaseUnit.trim() || undefined,
              purchaseFactor,
              lastPurchasePrice,
              yieldPercent: 100,
              storageOrder: 0,
            });
          }}
        >
          {save.isPending ? "Création…" : "Créer et choisir"}
        </Button>
      </div>
    </div>
  );
}
