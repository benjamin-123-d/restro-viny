import Link from "next/link";

import { formatCurrency } from "@/lib/format";

/**
 * Shared presentation for the purchasing screens. Every document in the chain
 * is a numbered header plus a status and a total, so they share one badge
 * vocabulary and one table shell rather than each list inventing its own.
 */

type Tone = "neutral" | "info" | "warn" | "good" | "danger";

const TONE_CLASS: Readonly<Record<Tone, string>> = {
  neutral: "bg-zinc-100 text-zinc-700",
  info: "bg-blue-100 text-blue-700",
  warn: "bg-amber-100 text-amber-800",
  good: "bg-green-100 text-green-700",
  danger: "bg-red-100 text-red-700",
};

/** How each status across the chain should read at a glance. */
const STATUS_TONE: Readonly<Record<string, Tone>> = {
  DRAFT: "neutral",
  CANCELLED: "neutral",
  CLOSED: "neutral",
  STOPPED: "neutral",
  EXPIRED: "neutral",
  SUBMITTED: "info",
  TO_RECEIVE_AND_BILL: "info",
  TO_RECEIVE: "info",
  TO_BILL: "info",
  PARTLY_BILLED: "warn",
  PARTIALLY_ORDERED: "warn",
  PARTLY_PAID: "warn",
  UNPAID: "warn",
  ON_HOLD: "warn",
  RETURN: "warn",
  DEBIT_NOTE_ISSUED: "warn",
  COMPLETED: "good",
  ORDERED: "good",
  PAID: "good",
  OVERDUE: "danger",
};

const humanise = (status: string): string =>
  status
    .toLowerCase()
    .split("_")
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());

export const StatusBadge = ({ status }: { status: string }) => (
  <span
    className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${
      TONE_CLASS[STATUS_TONE[status] ?? "neutral"]
    }`}
  >
    {humanise(status)}
  </span>
);

/** A slim progress bar for received / billed percentages. */
export const Progress = ({ percent }: { percent: number }) => (
  <div className="flex items-center gap-2">
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200">
      <div
        className={`h-full rounded-full ${
          percent >= 100 ? "bg-green-500" : "bg-blue-500"
        }`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
    <span className="tabular-nums text-xs text-zinc-500">
      {Math.round(percent)}%
    </span>
  </div>
);

export const Money = ({
  value,
  tone,
}: {
  value: number;
  tone?: "danger" | "muted";
}) => (
  <span
    className={`tabular-nums ${
      tone === "danger"
        ? "font-semibold text-red-600"
        : tone === "muted"
          ? "text-zinc-400"
          : ""
    }`}
  >
    {formatCurrency(value)}
  </span>
);

export const DocDate = ({ iso }: { iso: string | null }) => (
  <span className="whitespace-nowrap text-zinc-600">
    {iso
      ? new Date(iso).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—"}
  </span>
);

/** Table shell with a horizontal scroll container, so wide docs never break the page. */
export const DocTable = ({
  headers,
  children,
}: {
  headers: readonly { label: string; align?: "right" }[];
  children: React.ReactNode;
}) => (
  <div className="overflow-x-auto rounded-lg border bg-white">
    <table className="w-full min-w-[720px] text-sm">
      <thead className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
        <tr>
          {headers.map((h) => (
            <th
              key={h.label}
              className={`px-3 py-2 font-medium ${
                h.align === "right" ? "text-right" : ""
              }`}
            >
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

export const DocNumber = ({
  number,
  href,
}: {
  number: string;
  href?: string;
}) =>
  href ? (
    <Link
      href={href}
      className="font-mono text-xs font-medium text-blue-700 hover:underline"
    >
      {number}
    </Link>
  ) : (
    <span className="font-mono text-xs font-medium text-zinc-900">
      {number}
    </span>
  );

/** Tab strip shared by the purchasing, selling and stock modules. */
export const TabBar = ({
  tabs,
}: {
  tabs: readonly { href: string; label: string }[];
}) => (
  <nav className="overflow-x-auto border-b bg-white">
    <ul className="flex min-w-max gap-1 px-4 py-2 lg:px-6">
      {tabs.map((tab) => (
        <li key={tab.href}>
          <Link
            href={tab.href}
            className="block whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            {tab.label}
          </Link>
        </li>
      ))}
    </ul>
  </nav>
);
