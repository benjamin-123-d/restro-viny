import { getManagerContextOrNull } from "@/lib/manager-auth";
import { can } from "@/lib/permissions";
import { readTicketFilters } from "@/lib/ticket-filter-params";
import { resolveAccess } from "@/services/access.service";
import { listSaleTickets, saleTicketsCsv } from "@/services/sales-ledger.service";

/**
 * The filtered sales ledger as a spreadsheet. Same filters as the screen, read
 * from the same query string, so what is exported is exactly what is shown —
 * without the display cap, since a spreadsheet can hold the lot.
 */
export async function GET(request: Request): Promise<Response> {
  const ctx = await getManagerContextOrNull();
  if (!ctx) return new Response("Non connecté", { status: 401 });
  const access = await resolveAccess(ctx.userId, ctx.restaurantId);
  if (!access || !can(access, "ORDERS", "READ")) {
    return new Response("Accès refusé", { status: 403 });
  }

  const url = new URL(request.url);
  const { filters } = readTicketFilters(url.searchParams);
  const ledger = await listSaleTickets(ctx, { ...filters, limit: 100_000 });
  const csv = saleTicketsCsv(ledger);
  const day = new Date().toISOString().slice(0, 10);

  // Excel reads a French CSV correctly only with the byte order mark.
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ventes-${day}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
