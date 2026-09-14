import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { findOrderById } from "@/repositories/order.repository";
import { computeBill } from "@/services/billing";
import { getMenu } from "@/services/menu-item.service";
import { createOrder, orderToBillLines } from "@/services/order.service";
import { parisMidnight } from "@/services/sales-analytics.service";
import { settle } from "@/services/settlement.service";

/**
 * Demo POS tickets for the sales dashboard, placed and settled through the
 * real order and settlement services — so every VAT rate on every line is the
 * one the till itself would have computed, not a number made up here.
 *
 * Tickets are created oldest first, so invoice numbers run in date order as
 * French law requires. Idempotent: each ticket has a stable key and is skipped
 * if it already exists.
 *
 *   npx tsx scripts/seed-pos-tickets.ts            # create ~50 days of tickets
 *   npx tsx scripts/seed-pos-tickets.ts --purge    # remove them all again
 *
 * Before going live, run --purge: it also resets the invoice counter so the
 * first real invoice is F-00001 with no gap.
 */

const DEMO_NOTE = "Ticket de démonstration";
const DAYS = 50;

/** Deterministic PRNG, so the demo is the same every time it is generated. */
const rng = (() => {
  let state = 20260914;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
})();
const chance = (p: number) => rng() < p;
const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const between = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

/** Tickets per weekday, Monday first — busier towards the weekend. */
const TICKETS_PER_WEEKDAY = [6, 7, 8, 9, 12, 14, 10];

const purge = async (restaurantId: string) => {
  const demo = await prisma.order.findMany({
    where: { restaurantId, note: DEMO_NOTE },
    select: { id: true },
  });
  await prisma.order.deleteMany({ where: { id: { in: demo.map((o) => o.id) } } });

  // Restart invoice numbering right after the last real invoice.
  const lastReal = await prisma.order.aggregate({
    where: { restaurantId, invoiceNumber: { not: null } },
    _max: { invoiceNumber: true },
  });
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { nextInvoiceSeq: (lastReal._max.invoiceNumber ?? 0) + 1 },
  });
  console.log(`${demo.length} tickets de démonstration supprimés, numérotation remise à ${(lastReal._max.invoiceNumber ?? 0) + 1}.`);
};

const main = async () => {
  const restaurant = await prisma.restaurant.findFirst({
    select: { id: true, ownerId: true, name: true },
  });
  if (!restaurant) throw new Error("Aucun restaurant.");

  if (process.argv.includes("--purge")) {
    await purge(restaurant.id);
    return;
  }

  const ctx = { restaurantId: restaurant.id, userId: restaurant.ownerId };
  const menu = await getMenu(restaurant.id);
  const categoryName = new Map(menu.categories.map((c) => [c.id, c.name]));
  const inCategory = (name: string) =>
    menu.items.filter((i) => i.available && categoryName.get(i.categoryId) === name);

  const starters = inCategory("Entrees");
  const mains = inCategory("Plats principaux");
  const sides = inCategory("Accompagnements");
  const desserts = inCategory("Desserts");
  const drinks = inCategory("Boissons");
  const softDrinks = drinks.filter((d) => d.tax.vatCategory === "SOFT_DRINK");
  const alcohol = drinks.filter((d) => d.tax.vatCategory === "ALCOHOL");
  if (mains.length === 0) throw new Error("Le menu n'a pas de plats principaux.");

  const tables = await prisma.diningTable.findMany({
    where: { restaurantId: restaurant.id },
    select: { id: true },
  });

  const todayParis = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  let created = 0;
  let skipped = 0;

  for (let back = DAYS - 1; back >= 0; back -= 1) {
    const day = new Date(new Date(`${todayParis}T12:00:00Z`).getTime() - back * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
    const count = Math.max(2, TICKETS_PER_WEEKDAY[weekday] + between(-2, 3));

    // Sort the day's tickets by time so invoice numbers follow the clock.
    const slots = Array.from({ length: count }, () => {
      const lunch = chance(0.58);
      const minutes = lunch ? between(11 * 60 + 45, 14 * 60 + 15) : between(19 * 60, 22 * 60 + 15);
      return { lunch, minutes };
    }).sort((a, b) => a.minutes - b.minutes);

    for (const [n, slot] of slots.entries()) {
      const at = new Date(parisMidnight(day).getTime() + slot.minutes * 60_000);
      if (at.getTime() > Date.now()) continue;

      const key = `demo-${day}-${String(n).padStart(2, "0")}`;
      const existing = await prisma.order.findUnique({ where: { idempotencyKey: key } });
      if (existing) {
        skipped += 1;
        continue;
      }

      const roll = rng();
      const orderType = roll < 0.62 ? "DINE_IN" : roll < 0.9 ? "TAKEAWAY" : "DELIVERY";
      const covers = orderType === "DINE_IN" ? between(1, 4) : between(1, 2);

      const lines: { menuItemId: string; quantity: number; isComp: boolean; modifierIds: string[] }[] = [];
      const add = (id: string) => {
        const line = lines.find((l) => l.menuItemId === id);
        if (line) line.quantity += 1;
        else lines.push({ menuItemId: id, quantity: 1, isComp: false, modifierIds: [] });
      };

      for (let c = 0; c < covers; c += 1) {
        add(pick(mains).id);
        if (orderType === "DINE_IN") {
          if (starters.length && chance(0.4)) add(pick(starters).id);
          if (sides.length && chance(0.45)) add(pick(sides).id);
          if (desserts.length && chance(slot.lunch ? 0.25 : 0.45)) add(pick(desserts).id);
          if (drinks.length && chance(0.88)) {
            const wantsAlcohol = alcohol.length && chance(slot.lunch ? 0.2 : 0.45);
            add(pick(wantsAlcohol ? alcohol : softDrinks.length ? softDrinks : drinks).id);
          }
        } else {
          if (sides.length && chance(0.6)) add(pick(sides).id);
          if (softDrinks.length && chance(0.55)) add(pick(softDrinks).id);
          if (desserts.length && chance(0.15)) add(pick(desserts).id);
        }
      }

      const order = await createOrder(ctx, {
        orderType,
        idempotencyKey: key,
        note: DEMO_NOTE,
        ...(orderType === "DINE_IN" && tables.length ? { tableId: pick(tables).id } : {}),
        items: lines,
      });

      const full = await findOrderById(order.id);
      if (!full) continue;
      const total = computeBill(orderToBillLines(full)).grandTotal;

      // Weekday lunches are where titres-restaurant are spent.
      const payments =
        slot.lunch && weekday < 5 && chance(0.4)
          ? (() => {
              const voucher = Math.min(total, Math.round(between(1200, 2500)) / 100 * Math.min(covers, 2));
              const rest = Math.round((total - voucher) * 100) / 100;
              return [
                { mode: "MEAL_VOUCHER" as const, amount: Math.round(voucher * 100) / 100 },
                ...(rest > 0 ? [{ mode: "CARD" as const, amount: rest }] : []),
              ];
            })()
          : [{ mode: chance(0.7) ? ("CARD" as const) : ("CASH" as const), amount: total }];

      await settle(ctx, {
        orderId: order.id,
        discountType: "NONE",
        discountValue: 0,
        payments,
      });

      // Place the ticket at its real time of day.
      await prisma.order.update({
        where: { id: order.id },
        data: { createdAt: at, updatedAt: at, settledAt: new Date(at.getTime() + between(25, 70) * 60_000) },
      });
      await prisma.orderItem.updateMany({
        where: { orderId: order.id },
        data: { createdAt: at, firedAt: at, state: "SERVED" },
      });
      await prisma.payment.updateMany({
        where: { orderId: order.id },
        data: { createdAt: at },
      });
      created += 1;
    }
    process.stdout.write(`\r${day}  ${created} tickets créés`);
  }

  const totals = await prisma.order.aggregate({
    where: { restaurantId: restaurant.id, note: DEMO_NOTE },
    _count: { _all: true },
    _sum: { grandTotal: true, taxTotal: true },
  });
  console.log(`\n\n${created} tickets créés, ${skipped} déjà présents.`);
  console.log(
    `Total démo : ${totals._count._all} tickets, ${Number(totals._sum.grandTotal ?? 0).toFixed(2)} € TTC dont ${Number(totals._sum.taxTotal ?? 0).toFixed(2)} € de TVA.`,
  );
};

main()
  .catch((error) => {
    console.error("\n❌", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
