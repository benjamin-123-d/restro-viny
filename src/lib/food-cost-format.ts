import { UNIT_LABELS } from "@/lib/inventory";
import type { StockUnit } from "@/types/inventory";

/**
 * Figures as a kitchen reads them: a gram of tomato costs 0,000486 €, which
 * nobody can picture — so small units are shown per kilo or per litre.
 */
const BIG_UNIT: Readonly<Partial<Record<StockUnit, { label: string; factor: number }>>> = {
  GRAM: { label: "kg", factor: 1000 },
  ML: { label: "L", factor: 1000 },
};

const euro = (n: number, digits = 2): string =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(n)
    .replace(/ /g, " ");

export const formatUnitCost = (cost: number | null, unit: StockUnit): string => {
  if (cost == null) return "—";
  const big = BIG_UNIT[unit];
  if (big) return `${euro(cost * big.factor)}/${big.label}`;
  return `${euro(cost, cost < 0.1 ? 4 : 2)}/${UNIT_LABELS[unit]}`;
};

export const formatQuantity = (quantity: number, unit: StockUnit): string => {
  const big = BIG_UNIT[unit];
  if (big && Math.abs(quantity) >= big.factor) {
    return `${(quantity / big.factor).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${big.label}`;
  }
  return `${quantity.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ${UNIT_LABELS[unit]}`;
};

export const formatRatio = (ratio: number | null): string =>
  ratio == null ? "—" : `${ratio.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
