import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { SignJWT } from "jose";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Crawl every dashboard page as the real restaurant owner and report what
 * actually renders. A forged cookie only ever reaches the "no restaurant" empty
 * state, so this signs a genuine session — the only way to exercise the data
 * paths and catch runtime errors the type checker cannot see.
 *
 *   npx tsx scripts/audit-pages.ts [baseUrl]
 */

const BASE = process.argv[2] ?? "http://localhost:3000";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

const STATIC_ROUTES = [
  "/dashboard/food-cost",
  "/dashboard/food-cost/ingredients",
  "/dashboard/food-cost/fiches",
  "/dashboard/food-cost/achats",
  "/dashboard/food-cost/inventaire",
  "/dashboard/food-cost/pertes",
  "/dashboard/food-cost/bases",
  "/dashboard/food-cost/reglages",
  "/dashboard/inventory/reappro",
  "/dashboard/purchasing/quotations/request",
  "/dashboard/purchasing/quotations/new",
  "/dashboard/purchasing/receipts/new",
  "/dashboard/purchasing/rfq/new",
  "/dashboard/selling/deliveries/new",
  "/dashboard/stock/requests/new",
  "/dashboard/stock/counts/new",
  "/dashboard",
  "/dashboard/purchasing",
  "/dashboard/purchasing/suppliers",
  "/dashboard/purchasing/rfq",
  "/dashboard/purchasing/quotations",
  "/dashboard/purchasing/orders",
  "/dashboard/purchasing/receipts",
  "/dashboard/purchasing/invoices",
  "/dashboard/purchasing/payments",
  "/dashboard/selling",
  "/dashboard/selling/customers",
  "/dashboard/selling/quotations",
  "/dashboard/selling/orders",
  "/dashboard/selling/deliveries",
  "/dashboard/selling/invoices",
  "/dashboard/selling/payments",
  "/dashboard/stock",
  "/dashboard/stock/warehouses",
  "/dashboard/stock/bins",
  "/dashboard/stock/batches",
  "/dashboard/stock/requests",
  "/dashboard/stock/entries",
  "/dashboard/stock/counts",
  "/dashboard/accounting",
  "/dashboard/accounting/accounts",
  "/dashboard/accounting/journals",
  "/dashboard/accounting/trial-balance",
  "/dashboard/accounting/profit-and-loss",
  "/dashboard/accounting/balance-sheet",
  "/dashboard/accounting/ledger",
  "/dashboard/statistics",
  "/dashboard/settings/roles",
  "/dashboard/inventory",
  // Data-entry screens.
  "/dashboard/purchasing/suppliers/new",
  "/dashboard/purchasing/orders/new",
  "/dashboard/purchasing/invoices/new",
  "/dashboard/purchasing/payments/new",
  "/dashboard/selling/customers/new",
  "/dashboard/selling/quotations/new",
  "/dashboard/selling/orders/new",
  "/dashboard/selling/invoices/new",
  "/dashboard/selling/payments/new",
  "/dashboard/stock/warehouses/new",
  "/dashboard/stock/entries/new",
  "/dashboard/accounting/accounts/new",
  "/dashboard/accounting/journals/new",
];

/** Text that means the page rendered, but not the thing we meant it to. */
const RED_FLAGS = [
  "No restaurant yet",
  "Application error",
  "Internal Server Error",
  "Unhandled Runtime Error",
  "This page could not be found",
];

const main = async () => {
  const restaurant = await prisma.restaurant.findFirst({
    select: { id: true, ownerId: true },
  });
  if (!restaurant) throw new Error("No restaurant to audit.");

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(restaurant.ownerId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET ?? ""));

  // Detail pages, using real ids so they exercise real rows.
  const [invoice, rfq] = await Promise.all([
    prisma.salesInvoice.findFirst({ where: { restaurantId: restaurant.id } }),
    prisma.requestForQuotation.findFirst({ where: { restaurantId: restaurant.id } }),
  ]);
  const routes = [...STATIC_ROUTES];
  if (invoice) {
    routes.push(`/dashboard/selling/invoices/${invoice.id}`);
    routes.push(`/dashboard/selling/invoices/${invoice.id}?copy=duplicate`);
  }
  if (rfq) routes.push(`/dashboard/purchasing/rfq/${rfq.id}`);

  let failures = 0;
  for (const route of routes) {
    const started = Date.now();
    let status = 0;
    let flag = "";
    try {
      const res = await fetch(`${BASE}${route}`, {
        headers: { cookie: `restro_session=${token}` },
        redirect: "manual",
      });
      status = res.status;
      const html = status === 200 ? await res.text() : "";
      // Next streams fallback templates (including its 404 text) inside script
      // payloads on every page, so only visible text counts as evidence.
      const visible = html
        .replace(/<script[\s\S]*?<\/script>/g, " ")
        .replace(/<[^>]+>/g, " ");
      flag = RED_FLAGS.find((f) => visible.includes(f)) ?? "";
    } catch (error) {
      flag = error instanceof Error ? error.message : String(error);
    }
    const ok = status === 200 && !flag;
    if (!ok) failures += 1;
    console.log(
      `${ok ? "OK  " : "FAIL"} ${String(status).padEnd(4)} ${route}${
        flag ? `  <-- ${flag}` : ""
      }  (${Date.now() - started}ms)`,
    );
  }

  console.log(`\n${routes.length - failures}/${routes.length} pages healthy`);
  if (failures > 0) process.exitCode = 1;
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
