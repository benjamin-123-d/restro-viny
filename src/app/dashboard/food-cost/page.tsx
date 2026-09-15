import {
  CheckCircle2Icon,
  CircleIcon,
  SearchCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";

import { StartInventoryButton } from "@/components/food-cost/inventory-actions";
import { getFoodCostPageContext } from "@/components/food-cost/page-context";
import { ReliabilityBadge } from "@/components/food-cost/reliability-badge";
import { HelpBox } from "@/components/forms/help-box";
import { ChartCard, DataTable } from "@/components/sales/chart-card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatRatio } from "@/lib/food-cost-format";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getFoodCostOverview, listIngredients } from "@/services/food-cost.service";
import type { FoodCostOverviewDTO } from "@/types/food-cost";

export const metadata = { title: "Food cost" };

const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <section className={cn("flex flex-col gap-3 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 sm:p-5", className)}>
    {children}
  </section>
);

function Checklist({ items }: { readonly items: readonly { done: boolean; label: string; href: string }[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={item.label} className="flex items-center gap-3 text-sm">
          {item.done ? (
            <CheckCircle2Icon className="size-5 shrink-0 text-green-700 dark:text-green-400" aria-label="Fait" />
          ) : (
            <CircleIcon className="size-5 shrink-0 text-muted-foreground" aria-label="À faire" />
          )}
          <span className={cn(item.done && "text-muted-foreground line-through")}>
            {i + 1}. {item.label}
          </span>
          {!item.done ? (
            <Link href={item.href} className="ml-auto text-xs font-medium underline underline-offset-2">
              Y aller
            </Link>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function PeriodPicker({ data }: { readonly data: FoodCostOverviewDTO }) {
  const options = data.validatedInventories;
  return (
    <form className="flex flex-wrap items-end gap-2 print:hidden" method="get">
      <label className="flex flex-col text-xs text-muted-foreground">
        Inventaire de début
        <select name="debut" defaultValue={data.start?.id} className="mt-1 h-9 rounded-md border bg-background px-2 text-sm text-foreground">
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {formatDate(o.countedAt)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs text-muted-foreground">
        Inventaire de fin
        <select name="fin" defaultValue={data.end?.id} className="mt-1 h-9 rounded-md border bg-background px-2 text-sm text-foreground">
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {formatDate(o.countedAt)}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="h-9 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted">
        Afficher
      </button>
    </form>
  );
}

export default async function FoodCostPage({
  searchParams,
}: {
  searchParams: Promise<{ debut?: string; fin?: string }>;
}) {
  const page = await getFoodCostPageContext();
  if (!page) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Aucun restaurant" description="Demandez à un administrateur de créer votre restaurant." />
      </div>
    );
  }
  const { debut, fin } = await searchParams;
  const [data, ingredients] = await Promise.all([
    getFoodCostOverview(page.ctx, { startId: debut, endId: fin }),
    listIngredients(page.ctx),
  ]);
  const priced = ingredients.filter((i) => i.netUnitCost != null).length;

  const header = (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold tracking-tight">Food cost</h1>
      <p className="text-sm text-muted-foreground">Combien vous coûte réellement ce que vous vendez, et où part la différence.</p>
    </div>
  );

  if (data.status !== "READY" || !data.report) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 lg:p-6">
        {header}
        <Card className="items-center py-10 text-center">
          <SearchCheckIcon className="size-10 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-semibold">
            {data.status === "NO_INVENTORY"
              ? "Il faut un inventaire de début et un inventaire de fin"
              : "Encore un inventaire, et l'écart réel apparaît"}
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            {data.status === "NO_INVENTORY"
              ? "L'écart entre ce que vos ventes expliquent et ce que vous avez vraiment consommé se mesure entre deux comptages. Lancez le premier aujourd'hui : il servira de stock de départ."
              : `Votre inventaire du ${data.start ? formatDate(data.start.countedAt) : ""} sert de départ. Refaites un comptage dans quelques jours (une semaine est idéale) pour mesurer la période.`}
          </p>
          {page.canEdit ? (
            <StartInventoryButton label={data.status === "NO_INVENTORY" ? "Lancer le premier inventaire" : "Lancer l'inventaire de fin"} />
          ) : null}
        </Card>
        <Card>
          <h2 className="text-base font-semibold">En attendant, préparez le terrain</h2>
          <Checklist
            items={[
              { done: ingredients.length > 0 && priced === ingredients.length, label: `Donner un prix à chaque ingrédient (${priced}/${ingredients.length})`, href: "/dashboard/food-cost/ingredients" },
              { done: data.cards.dishes > 0 && data.cards.withCard === data.cards.dishes, label: `Composer les fiches techniques (${data.cards.withCard}/${data.cards.dishes})`, href: "/dashboard/food-cost/fiches" },
              { done: data.validatedInventories.length >= 1, label: "Faire l'inventaire de début", href: "/dashboard/food-cost/inventaire" },
              { done: false, label: "Vendre normalement : chaque vente fige son coût matière", href: "/dashboard/pos" },
              { done: data.validatedInventories.length >= 2, label: "Faire l'inventaire de fin", href: "/dashboard/food-cost/inventaire" },
            ]}
          />
        </Card>
      </div>
    );
  }

  const r = data.report;
  const over = r.variance > 0.005;
  const peakMargin = Math.max(1, ...data.topDishes.map((d) => d.margin));
  const maxRatio = Math.max(r.theoreticalRatio ?? 0, r.realRatio ?? 0, 1);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {header}
        <PeriodPicker data={data} />
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">
        Du {data.start ? formatDate(data.start.countedAt) : ""} au {data.end ? formatDate(data.end.countedAt) : ""} · {data.days} jour{data.days > 1 ? "s" : ""}
      </p>

      {/* The one figure the owner does not know. */}
      <Card className={cn("gap-2 sm:p-6", over ? "ring-2 ring-red-300 dark:ring-red-900" : "")}>
        <p className="text-sm font-medium text-muted-foreground">Écart matière de la période</p>
        <p className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
          {r.variance > 0 ? "+" : ""}
          {formatCurrency(r.variance)}
          <span className="ml-3 align-middle text-xl font-medium text-muted-foreground">
            {r.variancePoints > 0 ? "+" : ""}
            {r.variancePoints.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} pts de CA
          </span>
        </p>
        <p className="max-w-3xl text-lg leading-snug">{data.headline}</p>
        {r.lossesValue > 0 ? (
          <p className="text-sm text-muted-foreground">
            Dont {formatCurrency(r.lossesValue)} de pertes déclarées · reste inexpliqué : <strong className="text-foreground">{formatCurrency(r.unexplained)}</strong>
          </p>
        ) : null}
      </Card>

      {r.uncoveredShare > 0 ? (
        <p className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {formatRatio(r.uncoveredShare)} du chiffre d&apos;affaires HT ({formatCurrency(r.uncoveredRevenueHT)}) vient de plats vendus sans fiche complète : leur matière n&apos;est pas dans la consommation théorique, l&apos;écart est donc surévalué d&apos;autant.{" "}
          <Link href="/dashboard/food-cost/fiches" className="font-medium underline">Compléter les fiches</Link>
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Chiffre d'affaires HT", value: formatCurrency(r.revenueHT) },
          { label: "Consommation théorique", value: formatCurrency(r.theoretical), sub: `ratio ${formatRatio(r.theoreticalRatio)}` },
          { label: "Consommation réelle", value: formatCurrency(r.real), sub: `ratio ${formatRatio(r.realRatio)}` },
          { label: "Pertes déclarées", value: formatCurrency(r.lossesValue) },
          { label: "Achats payés (marché)", value: formatCurrency(data.purchasesPaid) },
        ].map((k) => (
          <div key={k.label} className="flex flex-col gap-1 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/10">
            <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
            <p className="text-xl font-semibold tabular-nums">{k.value}</p>
            {k.sub ? <p className="text-xs text-muted-foreground">{k.sub}</p> : null}
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold">Ratio matière : théorique et réel</h2>
          <p className="-mt-2 text-sm text-muted-foreground">Part du chiffre d&apos;affaires HT partie en matière.</p>
          {(
            [
              ["Théorique — ce que les ventes expliquent", r.theoreticalRatio, "bg-muted-foreground"],
              ["Réel — ce que les inventaires constatent", r.realRatio, "bg-foreground"],
            ] as const
          ).map(([label, ratio, tone]) => (
            <div key={label} className="flex flex-col gap-1">
              <div className="flex justify-between text-sm">
                <span>{label}</span>
                <span className="font-semibold tabular-nums">{formatRatio(ratio)}</span>
              </div>
              <div className="h-6 w-full rounded-[4px] bg-muted">
                <div className={cn("h-full rounded-[4px]", tone)} style={{ width: `${((ratio ?? 0) / maxRatio) * 100}%` }} />
              </div>
            </div>
          ))}
          <table className="mt-2 w-full text-sm">
            <caption className="mb-1 text-left text-xs text-muted-foreground">Consommation réelle</caption>
            <tbody>
              <tr><td className="py-1">Stock initial (inventaire de début)</td><td className="py-1 text-right tabular-nums">{formatCurrency(r.startValue)}</td></tr>
              <tr><td className="py-1">+ Entrées en stock (achats, réceptions)</td><td className="py-1 text-right tabular-nums">{formatCurrency(r.entriesValue)}</td></tr>
              <tr><td className="py-1">− Stock final (inventaire de fin)</td><td className="py-1 text-right tabular-nums">{formatCurrency(r.endValue)}</td></tr>
              <tr className="border-t font-semibold"><td className="py-1">= Consommation réelle</td><td className="py-1 text-right tabular-nums">{formatCurrency(r.real)}</td></tr>
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="text-base font-semibold">Où peut partir la différence</h2>
          <p className="-mt-2 text-sm text-muted-foreground">Quatre vérifications, dans cet ordre. Aucune ne désigne un coupable : ce sont des tests à faire.</p>
          <ol className="flex flex-col gap-3">
            {data.causes.map((cause, i) => (
              <li key={cause.key} className="flex gap-3 rounded-lg border p-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                <span>
                  <span className="block font-medium">{cause.title}</span>
                  <span className="text-muted-foreground">{cause.test}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ChartCard
          title="Les 5 plats qui rapportent le plus de marge"
          description="Marge brute sur la période (prix HT − coût matière figé), ratio matière à droite."
          chart={
            data.topDishes.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucune vente de plat avec fiche sur la période.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {data.topDishes.map((d) => (
                  <li key={d.menuItemId} className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3 text-sm">
                    <span className="truncate font-medium" title={d.name}>{d.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-6 rounded-r-[4px] bg-sales-dine-in" style={{ width: `${Math.max(2, (d.margin / peakMargin) * 70)}%` }} title={`${d.name} : ${formatCurrency(d.margin)} de marge`} />
                      <span className="shrink-0 tabular-nums">
                        <strong>{formatCurrency(d.margin)}</strong>{" "}
                        <span className="text-xs text-muted-foreground">· {d.quantity} vendus · ratio {formatRatio(d.ratio)}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )
          }
          table={
            <DataTable
              headers={[
                { label: "Plat" },
                { label: "Vendus", numeric: true },
                { label: "CA HT", numeric: true },
                { label: "Coût matière", numeric: true },
                { label: "Marge", numeric: true },
                { label: "Ratio", numeric: true },
              ]}
              rows={data.topDishes.map((d) => [d.name, d.quantity, formatCurrency(d.revenueHT), formatCurrency(d.cost), formatCurrency(d.margin), formatRatio(d.ratio)])}
            />
          }
        />

        <Card>
          <h2 className="text-base font-semibold">Fiabilité des fiches</h2>
          <p className="-mt-2 text-sm text-muted-foreground">
            {`${data.cards.withCard} plat${data.cards.withCard > 1 ? "s" : ""} sur ${data.cards.dishes} ${data.cards.withCard > 1 ? "ont" : "a"} une fiche. Plus elles sont vérifiées, plus l'écart est parlant.`}
          </p>
          <ul className="flex flex-col gap-2 text-sm">
            <li className="flex items-center justify-between"><ReliabilityBadge reliability="ESTIMATED" /><span className="tabular-nums">{data.cards.estimated}</span></li>
            <li className="flex items-center justify-between"><ReliabilityBadge reliability="ADJUSTED" /><span className="tabular-nums">{data.cards.adjusted}</span></li>
            <li className="flex items-center justify-between"><ReliabilityBadge reliability="VERIFIED" /><span className="tabular-nums">{data.cards.verified}</span></li>
            <li className="flex items-center justify-between text-muted-foreground"><span>Sans fiche</span><span className="tabular-nums">{data.cards.dishes - data.cards.withCard}</span></li>
          </ul>
          <Link href="/dashboard/food-cost/fiches" className="text-sm font-medium underline underline-offset-2">Voir les fiches</Link>
        </Card>
      </div>

      <HelpBox
        defaultOpen={false}
        title="Comment ces chiffres sont calculés"
        steps={[
          "Consommation théorique = Σ (quantité vendue × coût matière figé au moment de la vente).",
          "Consommation réelle = stock initial + entrées − stock final, valorisés au coût net d'usage.",
          "Écart = réelle − théorique ; en points de CA = écart ÷ CA HT × 100.",
        ]}
        tips={[
          "Aucune charge fixe (loyer, salaires, énergie) n'entre dans ce module.",
          "Le système n'impose jamais un prix de vente : la décision reste la vôtre.",
        ]}
      />
    </div>
  );
}
