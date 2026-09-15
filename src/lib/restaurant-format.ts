import type { RestaurantFormat } from "@/types/settings";

export const FORMAT_LABELS: Record<RestaurantFormat, string> = {
  FINE_DINING: "Gastronomique",
  CASUAL_DINING: "Restaurant traditionnel",
  QSR: "Restauration rapide",
  CAFE: "Café",
  CLOUD_KITCHEN: "Cuisine en livraison seule",
  BAR: "Bar / brasserie",
  BAKERY: "Boulangerie / pâtisserie",
  FOOD_TRUCK: "Food truck",
  OTHER: "Autre",
};

export const FORMAT_OPTIONS = (
  Object.keys(FORMAT_LABELS) as RestaurantFormat[]
).map((value) => ({ value, label: FORMAT_LABELS[value] }));

export const CUISINE_OPTIONS: readonly string[] = [
  "North Indian",
  "South Indian",
  "Chinese",
  "Continental",
  "Italian",
  "Mughlai",
  "Bengali",
  "Punjabi",
  "Fast Food",
  "Desserts",
  "Beverages",
  "Street Food",
  "Biryani",
  "Tandoor",
  "Seafood",
  "Vegan",
];
