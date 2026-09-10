import { describe, expect, it } from "vitest";

import {
  assertPostable,
  balanceOf,
  buildBalanceSheet,
  buildProfitAndLoss,
  buildTrialBalance,
  DEFAULT_CHART,
  JOURNAL_LINE_BOTH_SIDES,
  JOURNAL_LINE_EMPTY,
  JOURNAL_UNBALANCED,
  normalSide,
  totalJournal,
  type AccountRootType,
  type TrialBalanceRow,
} from "./accounting";

const row = (
  o: Partial<TrialBalanceRow> & { rootType: AccountRootType },
): TrialBalanceRow => ({
  accountId: o.accountId ?? "a1",
  code: o.code ?? "1000",
  name: o.name ?? "Account",
  debit: o.debit ?? 0,
  credit: o.credit ?? 0,
  balance: o.balance ?? 0,
  rootType: o.rootType,
});

describe("normalSide", () => {
  it("grows assets and expenses on the debit side", () => {
    expect(normalSide("ASSET")).toBe("DEBIT");
    expect(normalSide("EXPENSE")).toBe("DEBIT");
  });

  it("grows liabilities, equity and income on the credit side", () => {
    expect(normalSide("LIABILITY")).toBe("CREDIT");
    expect(normalSide("EQUITY")).toBe("CREDIT");
    expect(normalSide("INCOME")).toBe("CREDIT");
  });
});

describe("totalJournal", () => {
  it("adds each column and reports them balanced", () => {
    const t = totalJournal([
      { accountId: "a", debit: 1000, credit: 0 },
      { accountId: "b", debit: 0, credit: 1000 },
    ]);
    expect(t.totalDebit).toBe(1000);
    expect(t.totalCredit).toBe(1000);
    expect(t.difference).toBe(0);
    expect(t.isBalanced).toBe(true);
  });

  it("reports the gap when the columns disagree", () => {
    const t = totalJournal([
      { accountId: "a", debit: 1000, credit: 0 },
      { accountId: "b", debit: 0, credit: 600 },
    ]);
    expect(t.difference).toBe(400);
    expect(t.isBalanced).toBe(false);
  });

  it("does not call an empty journal balanced", () => {
    expect(totalJournal([]).isBalanced).toBe(false);
  });

  it("tolerates sub-cent rounding dust", () => {
    const t = totalJournal([
      { accountId: "a", debit: 100, credit: 0 },
      { accountId: "b", debit: 0, credit: 99.999 },
    ]);
    expect(t.isBalanced).toBe(true);
  });
});

describe("assertPostable", () => {
  it("accepts a balanced journal", () => {
    expect(() =>
      assertPostable([
        { accountId: "a", debit: 500, credit: 0 },
        { accountId: "b", debit: 0, credit: 500 },
      ]),
    ).not.toThrow();
  });

  it("refuses a line sitting on both sides at once", () => {
    expect(() =>
      assertPostable([{ accountId: "a", debit: 100, credit: 100 }]),
    ).toThrow(JOURNAL_LINE_BOTH_SIDES);
  });

  it("refuses a line with nothing on it", () => {
    expect(() =>
      assertPostable([{ accountId: "a", debit: 0, credit: 0 }]),
    ).toThrow(JOURNAL_LINE_EMPTY);
  });

  it("refuses a journal whose columns do not agree", () => {
    expect(() =>
      assertPostable([
        { accountId: "a", debit: 500, credit: 0 },
        { accountId: "b", debit: 0, credit: 400 },
      ]),
    ).toThrow(JOURNAL_UNBALANCED);
  });
});

describe("balanceOf", () => {
  it("reads a debit account as positive when money came in", () => {
    expect(balanceOf("ASSET", { debit: 5000, credit: 1200 })).toBe(3800);
  });

  it("reads a credit account as positive when it is genuinely owed", () => {
    expect(balanceOf("LIABILITY", { debit: 1000, credit: 4000 })).toBe(3000);
  });

  it("goes negative when an account is on the wrong side of itself", () => {
    expect(balanceOf("ASSET", { debit: 100, credit: 400 })).toBe(-300);
  });
});

describe("buildTrialBalance", () => {
  it("drops accounts that never moved", () => {
    const tb = buildTrialBalance([
      row({ rootType: "ASSET", accountId: "a", debit: 100, credit: 0 }),
      row({ rootType: "EXPENSE", accountId: "b" }),
    ]);
    expect(tb.rows).toHaveLength(1);
    expect(tb.rows[0].accountId).toBe("a");
  });

  it("totals both columns and confirms they agree", () => {
    const tb = buildTrialBalance([
      row({ rootType: "ASSET", accountId: "a", debit: 900, credit: 0 }),
      row({ rootType: "INCOME", accountId: "b", debit: 0, credit: 900 }),
    ]);
    expect(tb.totalDebit).toBe(900);
    expect(tb.totalCredit).toBe(900);
    expect(tb.isBalanced).toBe(true);
  });

  it("flags a ledger that does not add up", () => {
    const tb = buildTrialBalance([
      row({ rootType: "ASSET", accountId: "a", debit: 900, credit: 0 }),
      row({ rootType: "INCOME", accountId: "b", debit: 0, credit: 500 }),
    ]);
    expect(tb.isBalanced).toBe(false);
  });
});

describe("buildProfitAndLoss", () => {
  it("takes income less expense", () => {
    const pl = buildProfitAndLoss([
      row({ rootType: "INCOME", accountId: "i", balance: 12000 }),
      row({ rootType: "EXPENSE", accountId: "e", balance: 7500 }),
      row({ rootType: "ASSET", accountId: "a", balance: 99999 }),
    ]);
    expect(pl.totalIncome).toBe(12000);
    expect(pl.totalExpense).toBe(7500);
    expect(pl.netProfit).toBe(4500);
  });

  it("reports a loss as negative", () => {
    const pl = buildProfitAndLoss([
      row({ rootType: "INCOME", accountId: "i", balance: 1000 }),
      row({ rootType: "EXPENSE", accountId: "e", balance: 2500 }),
    ]);
    expect(pl.netProfit).toBe(-1500);
  });

  it("ignores balance-sheet accounts entirely", () => {
    const pl = buildProfitAndLoss([
      row({ rootType: "ASSET", accountId: "a", balance: 5000 }),
      row({ rootType: "LIABILITY", accountId: "l", balance: 5000 }),
    ]);
    expect(pl.totalIncome).toBe(0);
    expect(pl.totalExpense).toBe(0);
    expect(pl.netProfit).toBe(0);
  });
});

describe("buildBalanceSheet", () => {
  it("balances assets against liabilities, equity and the period profit", () => {
    const sheet = buildBalanceSheet([
      row({ rootType: "ASSET", accountId: "a", balance: 10000 }),
      row({ rootType: "LIABILITY", accountId: "l", balance: 3000 }),
      row({ rootType: "EQUITY", accountId: "q", balance: 5000 }),
      row({ rootType: "INCOME", accountId: "i", balance: 4000 }),
      row({ rootType: "EXPENSE", accountId: "e", balance: 2000 }),
    ]);
    expect(sheet.totalAssets).toBe(10000);
    expect(sheet.totalLiabilities).toBe(3000);
    expect(sheet.totalEquity).toBe(5000);
    expect(sheet.retainedProfit).toBe(2000);
    expect(sheet.isBalanced).toBe(true);
  });

  it("flags a sheet that does not balance", () => {
    const sheet = buildBalanceSheet([
      row({ rootType: "ASSET", accountId: "a", balance: 10000 }),
      row({ rootType: "LIABILITY", accountId: "l", balance: 1000 }),
    ]);
    expect(sheet.isBalanced).toBe(false);
  });
});

describe("DEFAULT_CHART", () => {
  it("uses a unique code for every account", () => {
    expect(new Set(DEFAULT_CHART.map((a) => a.code)).size).toBe(
      DEFAULT_CHART.length,
    );
  });

  it("only ever points a child at a code that exists", () => {
    const codes = new Set(DEFAULT_CHART.map((a) => a.code));
    for (const account of DEFAULT_CHART) {
      if (account.parent) expect(codes).toContain(account.parent);
    }
  });

  it("gives every root type a group account to hang under", () => {
    const groups = DEFAULT_CHART.filter((a) => a.isGroup).map((a) => a.rootType);
    for (const t of ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]) {
      expect(groups).toContain(t);
    }
  });

  it("never nests a child under a non-group account", () => {
    const byCode = new Map(DEFAULT_CHART.map((a) => [a.code, a]));
    for (const account of DEFAULT_CHART) {
      if (!account.parent) continue;
      expect(byCode.get(account.parent)?.isGroup).toBe(true);
    }
  });
});
