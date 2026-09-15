import type { StockMovementType, StockUnit } from "@/types/inventory";

export const UNIT_LABELS: Record<StockUnit, string> = {
  KG: "kg",
  GRAM: "g",
  LITRE: "L",
  ML: "ml",
  PIECE: "pièce",
  PACK: "paquet",
  BOTTLE: "bouteille",
  DOZEN: "douzaine",
};

export const STOCK_UNIT_OPTIONS: readonly { value: StockUnit; label: string }[] = [
  { value: "KG", label: "Kilogramme (kg)" },
  { value: "GRAM", label: "Gramme (g)" },
  { value: "LITRE", label: "Litre (L)" },
  { value: "ML", label: "Millilitre (ml)" },
  { value: "PIECE", label: "Pièce" },
  { value: "PACK", label: "Paquet" },
  { value: "BOTTLE", label: "Bouteille" },
  { value: "DOZEN", label: "Douzaine" },
];

export const WASTE_REASONS: readonly string[] = [
  "Avarié",
  "Date dépassée",
  "Casse",
  "Perte à la préparation",
  "Portion trop généreuse",
  "Offert / repas du personnel",
];

export const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  RECEIVE: "Entrée",
  WASTE: "Perte",
  CORRECTION: "Inventaire / correction",
  SALE_DEPLETION: "Vente",
  PRODUCTION: "Production",
};
