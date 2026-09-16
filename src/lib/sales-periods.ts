/**
 * The six windows every statistics screen offers. Kept away from the services
 * so a client component can show the buttons without pulling the database into
 * the browser bundle.
 */
export const PERIODS = [
  { key: "jour", label: "Aujourd'hui" },
  { key: "7j", label: "7 derniers jours" },
  { key: "30j", label: "30 derniers jours" },
  { key: "mois", label: "Ce mois-ci" },
  { key: "mois-dernier", label: "Mois dernier" },
  { key: "annee", label: "Cette année" },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

export const isPeriodKey = (value: string | undefined): value is PeriodKey =>
  PERIODS.some((p) => p.key === value);
