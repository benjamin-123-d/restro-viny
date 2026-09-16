import type { ServiceType } from "@/lib/french-vat";
import type { SaleTicketFilters } from "@/services/sales-ledger.service";

/**
 * The filters of the sales ledger live in the address bar, so a filtered view
 * can be shared, bookmarked or exported. One reader for the page and the
 * export route, so both always answer the same question.
 */

export interface TicketFilterValues {
  readonly from: string;
  readonly to: string;
  readonly service: string;
  readonly payment: string;
  readonly menuItemId: string;
  readonly search: string;
  readonly min: string;
  readonly max: string;
  readonly remise: string;
  readonly tri: string;
}

type Raw = Record<string, string | string[] | undefined> | URLSearchParams;

const read = (raw: Raw, key: string): string => {
  const value = raw instanceof URLSearchParams ? raw.get(key) : raw[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SERVICES = new Set(["DINE_IN", "TAKEAWAY", "DELIVERY"]);
const SORTS = new Set(["recent", "ancien", "montant", "montant-asc"]);

const money = (value: string): number | undefined => {
  const n = Number(value.replace(",", "."));
  return value === "" || Number.isNaN(n) ? undefined : n;
};

export const readTicketFilters = (raw: Raw): { filters: SaleTicketFilters; values: TicketFilterValues } => {
  const values: TicketFilterValues = {
    from: read(raw, "from"),
    to: read(raw, "to"),
    service: read(raw, "service"),
    payment: read(raw, "payment"),
    menuItemId: read(raw, "menuItemId"),
    search: read(raw, "search"),
    min: read(raw, "min"),
    max: read(raw, "max"),
    remise: read(raw, "remise"),
    tri: read(raw, "tri"),
  };

  return {
    values,
    filters: {
      from: DAY.test(values.from) ? values.from : undefined,
      to: DAY.test(values.to) ? values.to : undefined,
      service: SERVICES.has(values.service) ? (values.service as ServiceType) : undefined,
      payment: values.payment || undefined,
      menuItemId: values.menuItemId || undefined,
      search: values.search || undefined,
      minTotal: money(values.min),
      maxTotal: money(values.max),
      discountedOnly: values.remise === "1",
      sort: SORTS.has(values.tri) ? (values.tri as SaleTicketFilters["sort"]) : "recent",
    },
  };
};
