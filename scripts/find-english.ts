import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { SignJWT } from "jose";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Crawls the dashboard as the owner and reports the text still written in
 * English — what a French user would actually see, rather than what a grep of
 * the source guesses.
 *
 *   npx tsx scripts/find-english.ts [baseUrl]
 */

const BASE = process.argv[2] ?? "http://localhost:3000";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

const ROUTES = [
  "/dashboard",
  "/dashboard/pos",
  "/dashboard/orders",
  "/dashboard/sales",
  "/dashboard/menu",
  "/dashboard/tables",
  "/dashboard/inventory",
  "/dashboard/inventory/reappro",
  "/dashboard/food-cost",
  "/dashboard/food-cost/ingredients",
  "/dashboard/food-cost/fiches",
  "/dashboard/food-cost/achats",
  "/dashboard/food-cost/inventaire",
  "/dashboard/food-cost/pertes",
  "/dashboard/food-cost/bases",
  "/dashboard/food-cost/reglages",
  "/dashboard/purchasing",
  "/dashboard/purchasing/direct",
  "/dashboard/purchasing/direct/new",
  "/dashboard/purchasing/suppliers",
  "/dashboard/purchasing/suppliers/new",
  "/dashboard/purchasing/quotations",
  "/dashboard/purchasing/quotations/new",
  "/dashboard/purchasing/quotations/request",
  "/dashboard/purchasing/rfq",
  "/dashboard/purchasing/rfq/new",
  "/dashboard/purchasing/orders",
  "/dashboard/purchasing/orders/new",
  "/dashboard/purchasing/receipts",
  "/dashboard/purchasing/receipts/new",
  "/dashboard/purchasing/invoices",
  "/dashboard/purchasing/invoices/new",
  "/dashboard/purchasing/payments",
  "/dashboard/purchasing/payments/new",
  "/dashboard/selling",
  "/dashboard/selling/customers",
  "/dashboard/selling/customers/new",
  "/dashboard/selling/quotations",
  "/dashboard/selling/quotations/new",
  "/dashboard/selling/orders",
  "/dashboard/selling/orders/new",
  "/dashboard/selling/deliveries",
  "/dashboard/selling/deliveries/new",
  "/dashboard/selling/invoices",
  "/dashboard/selling/invoices/new",
  "/dashboard/selling/payments",
  "/dashboard/selling/payments/new",
  "/dashboard/stock",
  "/dashboard/stock/warehouses",
  "/dashboard/stock/warehouses/new",
  "/dashboard/stock/bins",
  "/dashboard/stock/batches",
  "/dashboard/stock/requests",
  "/dashboard/stock/requests/new",
  "/dashboard/stock/entries",
  "/dashboard/stock/entries/new",
  "/dashboard/stock/counts",
  "/dashboard/stock/counts/new",
  "/dashboard/accounting",
  "/dashboard/accounting/accounts",
  "/dashboard/accounting/accounts/new",
  "/dashboard/accounting/journals",
  "/dashboard/accounting/journals/new",
  "/dashboard/accounting/trial-balance",
  "/dashboard/accounting/profit-and-loss",
  "/dashboard/accounting/balance-sheet",
  "/dashboard/accounting/ledger",
  "/dashboard/statistics",
  "/dashboard/staff",
  "/dashboard/settings",
  "/dashboard/settings/roles",
  "/dashboard/kitchen",
  "/dashboard/waiter",
];

/** Words that only appear in English copy — accents alone are not enough. */
const ENGLISH = new RegExp(
  String.raw`\b(the|and|with|from|your|you|this|that|these|those|are|was|were|been|have|has|will|would|should|can't|cannot|don't|doesn't|its|it's|their|there|here|when|where|which|while|what|who|how|why|into|onto|about|above|below|before|after|between|during|without|within|again|already|always|never|only|other|another|each|every|some|any|none|both|either|neither|than|then|through|until|upon|very|much|many|more|most|less|least|first|last|next|previous|new|old|add|added|edit|delete|remove|save|saved|cancel|close|search|filter|loading|error|success|failed|choose|select|required|optional|amount|quantity|customer|supplier|invoice|payment|status|settings|staff|table|tables|menu|dish|note|notes|send|sent|back|yes|confirm|warning|unknown|empty|available|enable|disable|show|hide|open|closed|today|week|month|year|item|items|order|orders|stock|price|total|name|date|nothing|something|anything|everything|yet|still|per|use|used|using|make|made|get|got|set|see|seen|view|list|report|reports|manage|manager|owner|create|created|update|updated|record|records|entry|entries|receipt|receipts|delivery|warehouse|warehouses|count|counts|waste|loss|losses|batch|batches|request|requests|quote|quotes|quotation|quotations)\b`,
  "i",
);

const FRENCH = /[àâäéèêëîïôöùûüçœ]|\b(le|la|les|un|une|des|du|et|ou|pour|avec|dans|sur|par|vous|votre|vos|ce|cette|ces|est|sont|pas|plus|que|qui|aux?|en|son|ses|leur|tout|tous|sans|sous|entre|chez|aucun|aucune|prix|achat|vente|stock|facture|commande|client|fournisseur|date|montant|total)\b/i;

const clean = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/gi, " ");

const main = async () => {
  const restaurant = await prisma.restaurant.findFirst({ select: { id: true, ownerId: true } });
  if (!restaurant) throw new Error("Aucun restaurant.");
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(restaurant.ownerId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET ?? ""));

  const byPhrase = new Map<string, string[]>();
  for (const route of ROUTES) {
    const res = await fetch(`${BASE}${route}`, {
      headers: { cookie: `restro_session=${token}` },
      redirect: "manual",
    });
    if (res.status !== 200) {
      console.log(`(${res.status}) ${route}`);
      continue;
    }
    const lines = clean(await res.text())
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter((l) => l.length > 2 && /[A-Za-z]{3}/.test(l));
    for (const line of new Set(lines)) {
      if (FRENCH.test(line) || !ENGLISH.test(line)) continue;
      if (/^[A-Z0-9_\-. ]+$/.test(line) && line.length < 6) continue;
      byPhrase.set(line, [...(byPhrase.get(line) ?? []), route]);
    }
  }

  const sorted = [...byPhrase].sort((a, b) => b[1].length - a[1].length);
  console.log(`\n${sorted.length} texte(s) encore en anglais :\n`);
  for (const [phrase, routes] of sorted) {
    console.log(`"${phrase}"`);
    console.log(`    ${[...new Set(routes)].slice(0, 4).join(", ")}${routes.length > 4 ? ` (+${routes.length - 4})` : ""}`);
  }
  await prisma.$disconnect();
};

main().catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
