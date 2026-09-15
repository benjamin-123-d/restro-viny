import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { getPortionCosts } from "@/services/food-cost-pricing.service";
import {
  applyRecipeProposal,
  getRecipeCard,
  listIngredients,
  openInventory,
  proposeRecipeCard,
  recordLoss,
  recordPurchase,
  saveInventory,
  saveOwnRecipeCard,
  validateInventory,
  verifyRecipeCard,
} from "@/services/food-cost.service";

/**
 * Food cost demonstration on top of the demo POS tickets:
 *   - realistic French purchase units, HT prices and yields on the ingredients;
 *   - recipe cards proposed by the catalogue (some adjusted, one verified);
 *   - the demo tickets' frozen material cost;
 *   - an opening count 14 days back, market purchases and a few losses, and a
 *     closing count showing a readable variance (over-portioned chicken…).
 *
 *   npx tsx scripts/seed-food-cost.ts            # build the demo
 *   npx tsx scripts/seed-food-cost.ts --purge    # remove counts, purchases, losses and frozen demo costs
 *
 * Prices, purchase units and recipe cards are kept by --purge: they are a
 * useful starting point to correct, not throw away.
 */

const DEMO = "Démo food cost";
const DEMO_TICKET_NOTE = "Ticket de démonstration";
const DAYS = 14;
const DAY_MS = 86_400_000;

interface Price {
  readonly purchaseUnit: string;
  readonly factor: number;
  readonly price: number;
  readonly yieldPercent: number;
  readonly location: string;
  readonly category: string;
}

const P = (purchaseUnit: string, factor: number, price: number, yieldPercent: number, location: string, category: string): Price => ({
  purchaseUnit, factor, price, yieldPercent, location, category,
});

/** Market prices HT, by lower-case ingredient name (French and English stock names). */
const PRICES: Readonly<Record<string, Price>> = {
  tomates: P("cagette de 6 kg", 6, 13.8, 90, "Chambre froide", "Légumes"),
  tomatoes: P("cagette de 6 kg", 6, 13.8, 90, "Réserve (ancien stock)", "Légumes"),
  oignons: P("sac de 10 kg", 10, 9.5, 85, "Réserve sèche", "Légumes"),
  onions: P("sac de 10 kg", 10, 9.5, 85, "Réserve (ancien stock)", "Légumes"),
  poulet: P("carton de 10 kg", 10, 62, 70, "Chambre froide", "Viandes"),
  chicken: P("carton de 10 kg", 10, 62, 70, "Réserve (ancien stock)", "Viandes"),
  "poisson frais": P("caisse de 5 kg", 5, 64, 55, "Chambre froide", "Poissons"),
  fish: P("caisse de 5 kg", 5, 64, 55, "Réserve (ancien stock)", "Poissons"),
  riz: P("sac de 25 kg", 25, 42.5, 100, "Réserve sèche", "Épicerie"),
  rice: P("sac de 25 kg", 25, 42.5, 100, "Réserve (ancien stock)", "Épicerie"),
  huile: P("bidon de 5 L", 5, 11.9, 100, "Réserve sèche", "Épicerie"),
  "cooking oil": P("bidon de 5 L", 5, 11.9, 100, "Réserve (ancien stock)", "Épicerie"),
  arachide: P("sac de 5 kg", 5, 16.5, 100, "Réserve sèche", "Épicerie"),
  attieke: P("sachet de 1 kg", 1, 4.2, 100, "Réserve sèche", "Épicerie"),
  igname: P("sac de 10 kg", 10, 19, 80, "Réserve sèche", "Légumes"),
  plantains: P("régime de 20", 20, 9, 85, "Réserve sèche", "Légumes"),
  "biere locale": P("casier de 24", 24, 26.4, 100, "Cave", "Boissons"),
  beer: P("casier de 24", 24, 26.4, 100, "Réserve (ancien stock)", "Boissons"),
  "eau minerale 50cl": P("pack de 24", 24, 8.4, 100, "Cave", "Boissons"),
  "soft drinks": P("pack de 24", 24, 14.4, 100, "Réserve (ancien stock)", "Boissons"),
  piment: P("barquette de 500 g", 500, 4.5, 90, "Chambre froide", "Légumes"),
  "concentre de tomate": P("boîte de 400 g", 400, 1.6, 100, "Réserve sèche", "Épicerie"),
  carotte: P("sac de 5 kg", 5000, 6.5, 85, "Chambre froide", "Légumes"),
  "haricot vert": P("sachet de 1 kg", 1000, 4.8, 95, "Chambre froide", "Légumes"),
  "farine de mais": P("sac de 1 kg", 1000, 1.9, 100, "Réserve sèche", "Épicerie"),
  haricot: P("sac de 1 kg", 1000, 2.9, 100, "Réserve sèche", "Épicerie"),
  crevette: P("carton de 1 kg", 1000, 14.9, 60, "Congélateur", "Poissons"),
  farine: P("sac de 1 kg", 1000, 1.1, 100, "Réserve sèche", "Épicerie"),
  oeuf: P("plateau de 30", 30, 7.2, 100, "Chambre froide", "Crèmerie"),
  avocat: P("pièce", 1, 0.95, 70, "Réserve sèche", "Fruits"),
  "patate douce": P("sac de 1 kg", 1000, 2.6, 85, "Réserve sèche", "Légumes"),
  "fleur d'hibiscus": P("sachet de 500 g", 500, 6, 100, "Réserve sèche", "Épicerie"),
  sucre: P("sac de 1 kg", 1000, 1.35, 100, "Réserve sèche", "Épicerie"),
  eau: P("10 L", 10000, 0.04, 100, "Cuisine", "Boissons"),
  gingembre: P("sachet de 1 kg", 1000, 4.9, 85, "Chambre froide", "Légumes"),
  citron: P("pièce", 1, 0.35, 100, "Chambre froide", "Fruits"),
  mil: P("sac de 1 kg", 1000, 3.2, 100, "Réserve sèche", "Épicerie"),
  yaourt: P("seau de 1 kg", 1000, 2.4, 100, "Chambre froide", "Crèmerie"),
  ananas: P("pièce", 1, 2.2, 55, "Réserve sèche", "Fruits"),
  mangue: P("pièce", 1, 1.4, 65, "Réserve sèche", "Fruits"),
  banane: P("pièce", 1, 0.25, 70, "Réserve sèche", "Fruits"),
  orange: P("pièce", 1, 0.4, 60, "Réserve sèche", "Fruits"),
};

/** Consumption beyond what sales explain, per ingredient family of the story. */
const OVERUSE: Readonly<Record<string, number>> = { poulet: 1.09, "poisson frais": 1.05 };

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const purge = async (restaurantId: string) => {
  const inventories = await prisma.foodInventory.deleteMany({ where: { restaurantId, note: DEMO } });
  const purchases = await prisma.ingredientPurchase.findMany({ where: { restaurantId, note: DEMO }, select: { id: true } });
  await prisma.ingredientPurchase.deleteMany({ where: { id: { in: purchases.map((p) => p.id) } } });
  const losses = await prisma.foodLoss.deleteMany({ where: { restaurantId, reason: { endsWith: "(démo)" } } });
  // Take the demo's own purchases and losses back out of stock and history.
  const movements = await prisma.stockMovement.findMany({
    where: {
      restaurantId,
      OR: [
        { type: "RECEIVE", note: DEMO },
        { type: "WASTE", reason: { endsWith: "(démo)" } },
      ],
    },
    select: { id: true, stockItemId: true, quantity: true },
  });
  for (const m of movements) {
    await prisma.$transaction([
      prisma.stockItem.update({ where: { id: m.stockItemId }, data: { onHand: { decrement: m.quantity } } }),
      prisma.stockMovement.delete({ where: { id: m.id } }),
    ]);
  }
  const costs = await prisma.orderItem.updateMany({
    where: { order: { restaurantId, note: DEMO_TICKET_NOTE } },
    data: { foodCost: null },
  });
  console.log(
    `Supprimé : ${inventories.count} inventaires, ${purchases.length} achats, ${losses.count} pertes de démonstration ; ${costs.count} coûts figés retirés des tickets de démo.`,
  );
  console.log("Les mouvements de stock déjà passés restent dans l'historique ; refaites un inventaire pour repartir d'un stock réel.");
};

const main = async () => {
  const restaurant = await prisma.restaurant.findFirst({ select: { id: true, ownerId: true } });
  if (!restaurant) throw new Error("Aucun restaurant.");
  const ctx = { restaurantId: restaurant.id, userId: restaurant.ownerId };
  if (process.argv.includes("--purge")) return purge(restaurant.id);

  if (await prisma.foodInventory.count({ where: { restaurantId: restaurant.id, note: DEMO } })) {
    console.log("La démonstration food cost existe déjà (npx tsx scripts/seed-food-cost.ts --purge pour la refaire).");
    return;
  }

  // 1. Recipe cards from the catalogue for every dish without one.
  const dishes = await prisma.menuItem.findMany({
    where: { restaurantId: restaurant.id, deletedAt: null },
    select: { id: true, name: true, _count: { select: { recipe: true } } },
  });
  let cards = 0;
  for (const dish of dishes) {
    if (dish._count.recipe > 0) continue;
    const proposal = await proposeRecipeCard(ctx, dish.id).catch(() => null);
    if (!proposal) {
      console.log(`  pas de fiche type pour « ${dish.name} »`);
      continue;
    }
    await applyRecipeProposal(ctx, {
      menuItemId: dish.id,
      portions: proposal.portions,
      lines: proposal.lines.map((l) => ({
        stockItemId: l.stockItemId && l.quantity != null ? l.stockItemId : undefined,
        ingredient: l.ingredient,
        catalogueQuantity: l.catalogueQuantity,
        catalogueUnit: l.catalogueUnit,
        quantity: l.quantity ?? undefined,
      })),
    });
    cards += 1;
  }
  console.log(`${cards} fiches créées depuis le catalogue (estimées).`);

  // 2. Purchase units, prices and yields.
  const items = await prisma.stockItem.findMany({ where: { restaurantId: restaurant.id, deletedAt: null } });
  let priced = 0;
  for (const item of items) {
    const price = PRICES[item.name.toLowerCase()];
    if (!price) continue;
    await prisma.stockItem.update({
      where: { id: item.id },
      data: {
        purchaseUnit: price.purchaseUnit,
        purchaseFactor: price.factor,
        lastPurchasePrice: price.price,
        costPerUnit: price.price / price.factor,
        yieldPercent: price.yieldPercent,
        storageLocation: price.location,
        category: price.category,
      },
    });
    priced += 1;
  }
  console.log(`${priced} ingrédients avec unité d'achat, prix HT et rendement.`);

  // 3. A few cards corrected or weighed.
  for (const [name, verify] of [["Riz au gras", false], ["Poulet DG", false], ["Poisson braise", true]] as const) {
    const dish = dishes.find((d) => d.name === name);
    if (!dish) continue;
    const card = await getRecipeCard(ctx, dish.id);
    if (!card.hasCard) continue;
    await saveOwnRecipeCard(ctx, {
      menuItemId: dish.id,
      portions: card.portions,
      notes: undefined,
      lines: card.lines.map((l) => ({ stockItemId: l.stockItemId, quantity: l.quantity })),
    });
    if (verify) await verifyRecipeCard(ctx, dish.id);
  }

  // 4. Freeze today's portion costs on the demo tickets (sold before the cards existed).
  const costs = await getPortionCosts(restaurant.id, dishes.map((d) => d.id));
  let frozen = 0;
  for (const [menuItemId, cost] of costs) {
    if (cost == null) continue;
    const res = await prisma.orderItem.updateMany({
      where: { menuItemId, order: { restaurantId: restaurant.id, note: DEMO_TICKET_NOTE } },
      data: { foodCost: cost },
    });
    frozen += res.count;
  }
  console.log(`${frozen} lignes de tickets de démo avec coût matière figé.`);

  // 5. What the period's sales used, ingredient by ingredient (gross quantities).
  const now = Date.now();
  const start = new Date(now - DAYS * DAY_MS);
  const end = new Date(now - 60 * 60 * 1000);
  const soldLines = await prisma.orderItem.findMany({
    where: {
      state: { not: "VOID" },
      menuItemId: { not: null },
      order: { restaurantId: restaurant.id, status: { not: "VOID" }, createdAt: { gt: start, lte: end } },
    },
    select: { menuItemId: true, quantity: true },
  });
  const recipes = await prisma.recipeComponent.findMany({
    where: { menuItem: { restaurantId: restaurant.id } },
    select: { menuItemId: true, stockItemId: true, quantity: true, menuItem: { select: { recipeCard: { select: { portions: true } } } } },
  });
  const usage = new Map<string, number>();
  for (const line of soldLines) {
    for (const c of recipes.filter((r) => r.menuItemId === line.menuItemId)) {
      const perPortion = Number(c.quantity) / (c.menuItem.recipeCard?.portions ?? 1);
      usage.set(c.stockItemId, (usage.get(c.stockItemId) ?? 0) + perPortion * line.quantity);
    }
  }

  const ingredients = await listIngredients(ctx);
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  // 6. Opening count, 14 days back.
  const opening = new Map<string, number>();
  for (const i of ingredients) {
    const used = usage.get(i.id) ?? 0;
    opening.set(i.id, round3(used > 0 ? Math.ceil(used * 0.45 * 10) / 10 : Math.max(0, i.onHand)));
  }
  const first = await openInventory(ctx, start);
  const firstDetail = await prisma.foodInventoryLine.findMany({ where: { inventoryId: first.id }, select: { id: true, stockItemId: true } });
  const firstCounts = firstDetail.map((l) => ({ lineId: l.id, countedQty: opening.get(l.stockItemId) ?? 0 }));
  await saveInventory(ctx, { id: first.id, countedAt: start, counts: firstCounts });
  await validateInventory(ctx, { id: first.id, countedAt: start, counts: firstCounts });
  await prisma.foodInventory.update({ where: { id: first.id }, data: { note: DEMO, countedAt: start, validatedAt: start } });

  // 7. Market purchases on day 3 and day 9.
  const purchased = new Map<string, number>();
  for (const [stockItemId, used] of usage) {
    const item = byId.get(stockItemId);
    const price = item ? PRICES[item.name.toLowerCase()] : undefined;
    if (!item || !price) continue;
    const needed = used * 1.12 + used * 0.3 - (opening.get(stockItemId) ?? 0);
    const units = Math.max(1, Math.ceil(needed / price.factor));
    const split = [Math.ceil(units / 2), Math.floor(units / 2)].filter((n) => n > 0);
    for (const [index, qty] of split.entries()) {
      const purchasedAt = new Date(start.getTime() + (index === 0 ? 3 : 9) * DAY_MS + 7 * 3_600_000);
      const { id } = await recordPurchase(ctx, { stockItemId, quantity: qty, amount: Math.round(qty * price.price * 100) / 100, purchasedAt, note: DEMO });
      const row = await prisma.ingredientPurchase.findUniqueOrThrow({ where: { id }, select: { movementId: true } });
      if (row.movementId) await prisma.stockMovement.update({ where: { id: row.movementId }, data: { createdAt: purchasedAt } });
    }
    purchased.set(stockItemId, units * price.factor);
  }

  // 8. A few declared losses.
  const tomato = ingredients.find((i) => i.name === "Tomates");
  const pouletDG = dishes.find((d) => d.name === "Poulet DG");
  const losses: { lossAt: Date; run: () => Promise<void> }[] = [];
  if (tomato) {
    const lossAt = new Date(start.getTime() + 6 * DAY_MS);
    losses.push({ lossAt, run: () => recordLoss(ctx, { kind: "INGREDIENT", stockItemId: tomato.id, quantity: 1.5, reason: "Avarié (démo)", lossAt }) });
  }
  if (pouletDG) {
    const lossAt = new Date(start.getTime() + 10 * DAY_MS);
    losses.push({ lossAt, run: () => recordLoss(ctx, { kind: "DISH", menuItemId: pouletDG.id, quantity: 2, reason: "Assiette renvoyée (démo)", lossAt }) });
  }
  for (const loss of losses) await loss.run();

  // 9. Closing count: what is left, with a little more chicken and fish gone than the cards say.
  const lostQty = new Map<string, number>();
  if (tomato) lostQty.set(tomato.id, 1.5);
  if (pouletDG) {
    const card = await getRecipeCard(ctx, pouletDG.id);
    for (const l of card.lines) lostQty.set(l.stockItemId, (lostQty.get(l.stockItemId) ?? 0) + (l.quantity * 2) / card.portions);
  }
  // Everything that entered stock in the period: these purchases, and any
  // goods receipt or invoice already recorded in the purchasing module.
  const entries = await prisma.stockMovement.groupBy({
    by: ["stockItemId"],
    where: { restaurantId: restaurant.id, type: "RECEIVE", createdAt: { gt: start, lte: end } },
    _sum: { quantity: true },
  });
  const entered = new Map(entries.map((e) => [e.stockItemId, Number(e._sum.quantity ?? 0)]));
  const second = await openInventory(ctx, end);
  const secondDetail = await prisma.foodInventoryLine.findMany({ where: { inventoryId: second.id }, select: { id: true, stockItemId: true } });
  const secondCounts = secondDetail.map((l) => {
    const item = byId.get(l.stockItemId);
    const used = usage.get(l.stockItemId) ?? 0;
    const overuse = item ? (OVERUSE[item.name.toLowerCase()] ?? 1.02) : 1;
    const left = (opening.get(l.stockItemId) ?? 0) + (entered.get(l.stockItemId) ?? purchased.get(l.stockItemId) ?? 0) - used * overuse - (lostQty.get(l.stockItemId) ?? 0);
    return { lineId: l.id, countedQty: round3(Math.max(0, left)) };
  });
  await saveInventory(ctx, { id: second.id, countedAt: end, counts: secondCounts });
  await validateInventory(ctx, { id: second.id, countedAt: end, counts: secondCounts });
  await prisma.foodInventory.update({ where: { id: second.id }, data: { note: DEMO, countedAt: end, validatedAt: end } });

  console.log(`Inventaires validés : ${start.toLocaleDateString("fr-FR")} et ${end.toLocaleDateString("fr-FR")}. Ouvrez /dashboard/food-cost.`);
};

main()
  .catch((error) => {
    console.error("\n❌", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
