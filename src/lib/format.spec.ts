import { describe, expect, it } from "vitest";

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
  maskPhone,
} from "./format";

/** Intl uses no-break spaces; compare on plain spaces for readability. */
const plain = (s: string): string => s.replace(/[  ]/g, " ");

describe("formatCurrency", () => {
  it("writes euros the French way: decimal comma, sign last", () => {
    expect(plain(formatCurrency(12.5))).toBe("12,50 €");
  });

  it("separates thousands with a space", () => {
    expect(plain(formatCurrency(1234.56))).toBe("1 234,56 €");
  });

  it("always shows the cents", () => {
    expect(plain(formatCurrency(7))).toBe("7,00 €");
  });

  it("never lets the amount wrap away from its euro sign", () => {
    // No ordinary breaking space anywhere in the rendered string.
    expect(formatCurrency(1234.56)).not.toMatch(/ /);
  });
});

describe("formatTime", () => {
  it("renders in Paris time, not UTC", () => {
    // 00:00 UTC in January is 01:00 in Paris (CET, UTC+1).
    expect(formatTime("2026-01-01T00:00:00.000Z")).toContain("01:00");
  });

  it("follows French summer time", () => {
    // 12:00 UTC in July is 14:00 in Paris (CEST, UTC+2).
    expect(formatTime("2026-07-01T12:00:00.000Z")).toContain("14:00");
  });
});

describe("formatDateTime", () => {
  it("rolls over to the next day in Paris before UTC does", () => {
    // 23:30 UTC on 1 January is 00:30 on 2 January in Paris.
    const out = formatDateTime("2026-01-01T23:30:00.000Z");
    expect(out).toContain("02");
    expect(out).toContain("janv.");
    expect(out).toContain("00:30");
  });
});

describe("formatDate", () => {
  it("writes a document date as dd/mm/yyyy", () => {
    expect(formatDate("2026-09-14T10:00:00.000Z")).toBe("14/09/2026");
  });
});

describe("maskPhone", () => {
  it("shows only the last 3 digits", () => {
    expect(maskPhone("+33612345678")).toBe("••678");
  });

  it("ignores non-digit characters", () => {
    expect(maskPhone("+33 6 12 34 56 78")).toBe("••678");
  });

  it("returns empty for a value with no digits", () => {
    expect(maskPhone("")).toBe("");
  });
});
