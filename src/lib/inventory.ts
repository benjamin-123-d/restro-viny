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

/**
 * Movements recorded before the app spoke French kept English reasons in the
 * database; the history reads them back in French without rewriting history.
 */
const LEGACY_REASONS: Readonly<Record<string, string>> = {
  "Physical count": "Comptage",
  "Opening stock": "Stock de départ",
  "Purchase receipt": "Réception",
  "Purchase return": "Retour fournisseur",
  "Purchase receipt cancelled": "Réception annulée",
  "Purchase invoice": "Facture fournisseur",
  "Purchase invoice cancelled": "Facture fournisseur annulée",
  "Sales invoice": "Facture client",
  "Sales invoice cancelled": "Facture client annulée",
  "Sales return": "Retour client",
  "Delivery note": "Bon de livraison",
  "Delivery note cancelled": "Bon de livraison annulé",
  "Stock reconciliation": "Comptage d'entrepôt",
  "Stock entry": "Mouvement de stock",
  "Stock entry cancelled": "Mouvement de stock annulé",
  "Spoiled": "Avarié",
  "Spill": "Renversé",
  "Expired": "Date dépassée",
  "Breakage": "Casse",
  "Staff meal": "Repas du personnel",
  "Order": "Commande",
  "Order voided": "Commande annulée",
};

export const movementReasonLabel = (reason: string | null): string | null =>
  reason == null ? null : (LEGACY_REASONS[reason] ?? reason);
