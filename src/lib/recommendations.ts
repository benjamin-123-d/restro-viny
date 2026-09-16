/**
 * Les recommandations du moment — the sentences behind the floating lamp.
 *
 * No IO here: figures in, advice out. Every rule reads numbers the owner can
 * already check on another screen, so a recommendation can always be traced
 * back to a chart rather than to a hunch. And every sentence says what to *do*
 * — a dashboard already shows the figure; the lamp is only worth a tap if it
 * tells the owner the next move.
 */

import { formatCurrency } from "@/lib/format";

export type RecommendationTone = "info" | "attention" | "bravo";

export interface Recommendation {
  /** Stable key — used by React and by the specs, never shown. */
  readonly id: string;
  /** Short label, three or four words. */
  readonly title: string;
  /** One French sentence: the finding, then the action to take. */
  readonly detail: string;
  readonly tone: RecommendationTone;
  /** Where to go to act on it, when a screen exists for that. */
  readonly href?: string;
  /** Higher comes first. */
  readonly priority: number;
}

export interface SupplierDue {
  /** Everything still owed to suppliers. */
  readonly total: number;
  /** The share of it whose due date has passed. */
  readonly overdue: number;
  /** Number of unpaid documents. */
  readonly count: number;
}

export interface RecommendationInput {
  readonly revenueToday: number;
  readonly revenueYesterday: number;
  readonly ticketsToday: number;
  readonly averageTicketToday: number;
  /** Material cost as a share of revenue, 0–100. Null without recipe cards. */
  readonly marginRatio: number | null;
  /** The same ratio over the period just before, to see the drift. */
  readonly previousMarginRatio: number | null;
  /** Share of revenue whose cost is known, 0–100 — how much to trust the ratio. */
  readonly marginCoverage: number | null;
  readonly dishesWithoutCard: number;
  readonly lowStockCount: number;
  /** A few names to quote; the count stays authoritative. */
  readonly lowStockNames: readonly string[];
  readonly openTicketCount: number;
  readonly openTicketTotal: number;
  readonly oldestOpenTicketMinutes: number | null;
  readonly supplierDue: SupplierDue;
  readonly unsplitPurchaseCount: number;
  /** Revenue per weekday over the recent weeks, Monday first, 7 entries. */
  readonly weekdayRevenue: readonly number[];
  /** How the margin period reads in French, e.g. "7 derniers jours". */
  readonly marginPeriodLabel: string;
}

// --------------------------------------------------------------- réglages ---

/** A ticket left open past the end of a service is forgotten money. */
const OPEN_TICKET_ALERT_MINUTES = 90;
/** Below this, a day-to-day swing is just noise — service by service it moves. */
const SALES_SWING_PERCENT = 20;
/** Two points of material ratio on a 30 % base is roughly 7 % of the margin. */
const MARGIN_DRIFT_POINTS = 2;
/** A weekday is "creux" when it earns less than 60 % of an average open day. */
const WEAK_DAY_SHARE = 0.6;
/** Enough open days for an average to mean anything. */
const MIN_OPEN_DAYS = 3;
/** The panel is read standing up: past six lines nobody reads any of them. */
const MAX_RECOMMENDATIONS = 6;
/** Naming more than three products turns the sentence into a list. */
const MAX_NAMES = 3;

// ----------------------------------------------------------------- mots ---

const NBSP = " ";

const WEEKDAY_NAME = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
] as const;

const COUNT_WORD = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
] as const;

/** "trois" up to nine, then digits — spelled out reads like a sentence. */
const countWord = (n: number): string => COUNT_WORD[n] ?? String(n);

const capitalize = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

const round1 = (n: number): number => Math.round(n * 10) / 10;

const pct = (n: number): string =>
  `${round1(n).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}${NBSP}%`;

const signedPct = (n: number): string =>
  `${n >= 0 ? "+" : "−"}${pct(Math.abs(n))}`;

/** "2 h 15" for a long wait, "45 min" for a short one. */
const duration = (minutes: number): string => {
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 60) return `${whole}${NBSP}min`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0
    ? `${hours}${NBSP}h`
    : `${hours}${NBSP}h${NBSP}${String(rest).padStart(2, "0")}`;
};

/** "Poulet, Tomates, Huile et 2 autres" — quote a few, count the rest. */
const nameList = (names: readonly string[], total: number): string => {
  const shown = names.slice(0, MAX_NAMES);
  if (shown.length === 0) return "";
  const rest = Math.max(0, total - shown.length);
  return rest === 0 ? shown.join(", ") : `${shown.join(", ")} et ${rest} autres`;
};

// -------------------------------------------------------------- analyses ---

interface WeakDay {
  readonly index: number;
  readonly share: number;
}

/**
 * The quietest day of the week — but only among days the restaurant actually
 * opens. A day at zero is a closing day, and advising a special offer on a
 * closing day is exactly the kind of tip that gets the lamp switched off.
 */
const weakestWeekday = (revenue: readonly number[]): WeakDay | null => {
  const open = revenue
    .map((amount, index) => ({ amount, index }))
    .filter((day) => day.amount > 0);
  if (open.length < MIN_OPEN_DAYS) return null;
  const total = open.reduce((sum, day) => sum + day.amount, 0);
  const average = total / open.length;
  const weakest = open.reduce((a, b) => (b.amount < a.amount ? b : a));
  if (weakest.amount >= average * WEAK_DAY_SHARE) return null;
  return { index: weakest.index, share: round1((weakest.amount / total) * 100) };
};

// -------------------------------------------------------------- règles ---

const stockRule = (input: RecommendationInput): Recommendation | null => {
  const { lowStockCount: count, lowStockNames: names } = input;
  if (count <= 0) return null;
  const action = "passez commande avant le service de ce soir.";
  if (count === 1) {
    const subject = names[0] ?? "Un ingrédient";
    return {
      id: "stock-bas",
      title: "Stock sous le seuil",
      detail: `${subject} est sous son seuil : ${action}`,
      tone: "attention",
      href: "/dashboard/inventory",
      priority: 90,
    };
  }
  const quoted = nameList(names, count);
  return {
    id: "stock-bas",
    title: "Stock sous le seuil",
    detail: `${capitalize(countWord(count))} ingrédients passent sous leur seuil${
      quoted ? ` (${quoted})` : ""
    } : ${action}`,
    tone: "attention",
    href: "/dashboard/inventory",
    priority: 90,
  };
};

const openTicketRule = (input: RecommendationInput): Recommendation | null => {
  const minutes = input.oldestOpenTicketMinutes;
  if (
    input.openTicketCount <= 0 ||
    minutes == null ||
    minutes < OPEN_TICKET_ALERT_MINUTES
  ) {
    return null;
  }
  const waited = duration(minutes);
  const detail =
    input.openTicketCount === 1
      ? `Un ticket est ouvert depuis ${waited} : encaissez-le ou clôturez-le avant la fermeture.`
      : `${capitalize(countWord(input.openTicketCount))} tickets sont encore ouverts, le plus ancien depuis ${waited}, pour ${formatCurrency(
          input.openTicketTotal,
        )} : encaissez-les ou clôturez-les avant la fermeture.`;
  return {
    id: "tickets-ouverts",
    title: "Tickets non encaissés",
    detail,
    tone: "attention",
    href: "/dashboard/orders",
    priority: 95,
  };
};

const supplierRule = (input: RecommendationInput): Recommendation | null => {
  const { total, overdue, count } = input.supplierDue;
  if (overdue > 0) {
    return {
      id: "factures-echues",
      title: "Factures fournisseurs échues",
      detail: `${formatCurrency(overdue)} de factures fournisseurs sont échues sur ${formatCurrency(
        total,
      )} restant à régler : réglez-les ou appelez le fournisseur avant la prochaine livraison.`,
      tone: "attention",
      href: "/dashboard/purchasing/invoices",
      priority: 85,
    };
  }
  if (total <= 0 || count <= 0) return null;
  return {
    id: "factures-a-payer",
    title: "Factures fournisseurs à régler",
    detail: `${capitalize(countWord(count))} facture${
      count > 1 ? "s" : ""
    } fournisseur reste${count > 1 ? "nt" : ""} à régler pour ${formatCurrency(
      total,
    )} : planifiez les règlements pour ne pas bloquer la prochaine commande.`,
    tone: "info",
    href: "/dashboard/purchasing/invoices",
    priority: 40,
  };
};

const marginRule = (input: RecommendationInput): Recommendation | null => {
  const { marginRatio: now, previousMarginRatio: before } = input;
  if (now == null || before == null) return null;
  const drift = now - before;
  if (Math.abs(drift) < MARGIN_DRIFT_POINTS) return null;
  const window = `sur les ${input.marginPeriodLabel}`;
  // A rising material ratio means a falling margin: same fact, owner's words.
  return drift > 0
    ? {
        id: "marge-en-baisse",
        title: "Marge matière en baisse",
        detail: `Le ratio matière est passé de ${pct(before)} à ${pct(
          now,
        )} ${window} : revoyez les portions et les prix d'achat de vos plats les plus vendus.`,
        tone: "attention",
        href: "/dashboard/statistics/benefices",
        priority: 80,
      }
    : {
        id: "marge-en-hausse",
        title: "Marge matière en hausse",
        detail: `Le ratio matière est descendu de ${pct(before)} à ${pct(
          now,
        )} ${window} : gardez ces portions et ces fournisseurs, c'est ce qui fait la marge.`,
        tone: "bravo",
        href: "/dashboard/statistics/benefices",
        priority: 30,
      };
};

const salesRule = (input: RecommendationInput): Recommendation | null => {
  const { revenueToday: today, revenueYesterday: yesterday } = input;
  // Growing from nothing is not a percentage; better to say nothing.
  if (yesterday <= 0) return null;
  const change = ((today - yesterday) / yesterday) * 100;
  if (Math.abs(change) < SALES_SWING_PERCENT) return null;
  const facts = `${formatCurrency(today)} encaissés aujourd'hui contre ${formatCurrency(
    yesterday,
  )} hier, soit ${signedPct(round1(change))}`;
  return change < 0
    ? {
        id: "ventes-en-baisse",
        title: "Ventes en baisse",
        detail: `${facts} : vérifiez le service du soir et relancez vos habitués avant la fermeture.`,
        tone: "attention",
        href: "/dashboard/statistics/ventes",
        priority: 70,
      }
    : {
        id: "ventes-en-hausse",
        title: "Ventes en hausse",
        detail: `${facts} : notez ce qui a marché aujourd'hui pour le refaire demain.`,
        tone: "bravo",
        href: "/dashboard/statistics/ventes",
        priority: 35,
      };
};

const weakDayRule = (input: RecommendationInput): Recommendation | null => {
  const weak = weakestWeekday(input.weekdayRevenue);
  if (!weak) return null;
  const day = WEEKDAY_NAME[weak.index];
  return {
    id: "jour-creux",
    title: "Jour creux de la semaine",
    detail: `Le ${day} ne pèse que ${pct(
      weak.share,
    )} du chiffre des dernières semaines : testez une formule ce jour-là ou allégez l'équipe.`,
    tone: "info",
    href: "/dashboard/statistics/ventes",
    priority: 25,
  };
};

const recipeCardRule = (input: RecommendationInput): Recommendation | null => {
  const count = input.dishesWithoutCard;
  if (count <= 0) return null;
  const coverage = input.marginCoverage;
  // Only mention the coverage when it actually weakens the figure.
  const note =
    coverage != null && coverage < 95
      ? ` (seulement ${pct(coverage)} du chiffre couvert)`
      : "";
  return {
    id: "fiches-manquantes",
    title: "Fiches techniques manquantes",
    detail: `${capitalize(countWord(count))} plats vendus n'ont pas de fiche technique${note} : complétez-les pour que la marge affichée soit la vraie.`,
    tone: "info",
    href: "/dashboard/food-cost/fiches",
    priority: 45,
  };
};

const unsplitPurchaseRule = (
  input: RecommendationInput,
): Recommendation | null => {
  const count = input.unsplitPurchaseCount;
  if (count <= 0) return null;
  return {
    id: "achats-non-ventiles",
    title: "Achats non ventilés",
    detail: `${capitalize(countWord(count))} facture${count > 1 ? "s" : ""} d'achat ${
      count > 1 ? "ne sont pas ventilées" : "n'est pas ventilée"
    } par poste : classez-${count > 1 ? "les" : "la"} pour que le résultat des achats soit juste.`,
    tone: "info",
    href: "/dashboard/purchasing/invoices",
    priority: 20,
  };
};

const ALL_GOOD: Recommendation = {
  id: "tout-va-bien",
  title: "Tout est en ordre",
  detail:
    "Rien ne coince pour l'instant : stock au-dessus des seuils, factures fournisseurs à jour et tickets encaissés. Gardez le cap.",
  tone: "bravo",
  priority: 10,
};

const RULES: readonly ((
  input: RecommendationInput,
) => Recommendation | null)[] = [
  openTicketRule,
  stockRule,
  supplierRule,
  marginRule,
  salesRule,
  recipeCardRule,
  weakDayRule,
  unsplitPurchaseRule,
];

/**
 * The advice of the moment, most urgent first. The panel is never empty: when
 * nothing needs doing, the owner gets the one sentence that says so — silence
 * would read as a broken screen.
 */
export const buildRecommendations = (
  input: RecommendationInput,
): Recommendation[] => {
  const found = RULES.map((rule) => rule(input)).filter(
    (rec): rec is Recommendation => rec !== null,
  );
  const list =
    found.some((rec) => rec.tone === "attention") ? found : [...found, ALL_GOOD];
  return list
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, MAX_RECOMMENDATIONS);
};

/** How many recommendations actually ask for a move — what the badge counts. */
export const actionableCount = (
  recommendations: readonly Recommendation[],
): number => recommendations.filter((rec) => rec.tone === "attention").length;
