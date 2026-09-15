/**
 * Pure double-entry rules. No IO — the arithmetic every report depends on is
 * deterministic and exhaustively unit-tested.
 */

export type AccountRootType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "INCOME"
  | "EXPENSE";

/**
 * Which side increases an account. Assets and expenses grow on the debit side;
 * liabilities, equity and income grow on the credit side. This one fact decides
 * every balance sign in the reports.
 */
export const normalSide = (rootType: AccountRootType): "DEBIT" | "CREDIT" =>
  rootType === "ASSET" || rootType === "EXPENSE" ? "DEBIT" : "CREDIT";

const money = (n: number): number => Math.round(n * 100) / 100;

/** Sub-cent dust from splits should never make a balanced journal look wrong. */
const EPSILON = 0.005;

export interface JournalLine {
  readonly accountId: string;
  readonly debit: number;
  readonly credit: number;
}

export interface JournalTotals {
  readonly totalDebit: number;
  readonly totalCredit: number;
  readonly difference: number;
  readonly isBalanced: boolean;
}

export const totalJournal = (
  lines: readonly JournalLine[],
): JournalTotals => {
  const totalDebit = money(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = money(lines.reduce((s, l) => s + l.credit, 0));
  const difference = money(totalDebit - totalCredit);
  return {
    totalDebit,
    totalCredit,
    difference,
    isBalanced: Math.abs(difference) <= EPSILON && totalDebit > 0,
  };
};

export const JOURNAL_UNBALANCED = "JOURNAL_UNBALANCED";
export const JOURNAL_LINE_BOTH_SIDES = "JOURNAL_LINE_BOTH_SIDES";
export const JOURNAL_LINE_EMPTY = "JOURNAL_LINE_EMPTY";

/**
 * Reject a journal that could not be posted honestly: a line must sit on
 * exactly one side, and the two columns must agree.
 */
export const assertPostable = (lines: readonly JournalLine[]): void => {
  for (const line of lines) {
    if (line.debit > 0 && line.credit > 0) {
      throw new Error(JOURNAL_LINE_BOTH_SIDES);
    }
    if (line.debit <= 0 && line.credit <= 0) {
      throw new Error(JOURNAL_LINE_EMPTY);
    }
  }
  if (!totalJournal(lines).isBalanced) {
    throw new Error(JOURNAL_UNBALANCED);
  }
};

export interface LedgerTotals {
  readonly debit: number;
  readonly credit: number;
}

/**
 * The signed balance of an account, positive when it sits on its natural side.
 * A bank account with more in than out reads positive; so does a supplier
 * payable the business genuinely owes.
 */
export const balanceOf = (
  rootType: AccountRootType,
  totals: LedgerTotals,
): number =>
  money(
    normalSide(rootType) === "DEBIT"
      ? totals.debit - totals.credit
      : totals.credit - totals.debit,
  );

export interface TrialBalanceRow {
  readonly accountId: string;
  readonly code: string;
  readonly name: string;
  readonly rootType: AccountRootType;
  readonly debit: number;
  readonly credit: number;
  readonly balance: number;
}

export interface TrialBalance {
  readonly rows: readonly TrialBalanceRow[];
  readonly totalDebit: number;
  readonly totalCredit: number;
  readonly isBalanced: boolean;
}

/** Accounts with no movement at all are dropped — a trial balance is a working
 *  document, not a copy of the chart. */
export const buildTrialBalance = (
  rows: readonly TrialBalanceRow[],
): TrialBalance => {
  const active = rows.filter((r) => r.debit !== 0 || r.credit !== 0);
  const totalDebit = money(active.reduce((s, r) => s + r.debit, 0));
  const totalCredit = money(active.reduce((s, r) => s + r.credit, 0));
  return {
    rows: active,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) <= EPSILON,
  };
};

export interface ProfitAndLoss {
  readonly income: readonly TrialBalanceRow[];
  readonly expense: readonly TrialBalanceRow[];
  readonly totalIncome: number;
  readonly totalExpense: number;
  readonly netProfit: number;
}

/** Income less expense over the window. Both are read on their natural side,
 *  so a profit is positive and a loss is negative. */
export const buildProfitAndLoss = (
  rows: readonly TrialBalanceRow[],
): ProfitAndLoss => {
  const income = rows.filter((r) => r.rootType === "INCOME" && r.balance !== 0);
  const expense = rows.filter(
    (r) => r.rootType === "EXPENSE" && r.balance !== 0,
  );
  const totalIncome = money(income.reduce((s, r) => s + r.balance, 0));
  const totalExpense = money(expense.reduce((s, r) => s + r.balance, 0));
  return {
    income,
    expense,
    totalIncome,
    totalExpense,
    netProfit: money(totalIncome - totalExpense),
  };
};

export interface BalanceSheet {
  readonly assets: readonly TrialBalanceRow[];
  readonly liabilities: readonly TrialBalanceRow[];
  readonly equity: readonly TrialBalanceRow[];
  readonly totalAssets: number;
  readonly totalLiabilities: number;
  readonly totalEquity: number;
  /** Profit for the period, which equity does not yet carry. */
  readonly retainedProfit: number;
  readonly isBalanced: boolean;
}

/**
 * Assets = liabilities + equity + profit for the period. The profit term is
 * what makes the sheet balance before a year-end closing entry moves it into
 * equity — ERPNext shows it the same way.
 */
export const buildBalanceSheet = (
  rows: readonly TrialBalanceRow[],
): BalanceSheet => {
  const pick = (t: AccountRootType) =>
    rows.filter((r) => r.rootType === t && r.balance !== 0);
  const sum = (list: readonly TrialBalanceRow[]) =>
    money(list.reduce((s, r) => s + r.balance, 0));

  const assets = pick("ASSET");
  const liabilities = pick("LIABILITY");
  const equity = pick("EQUITY");
  const { netProfit } = buildProfitAndLoss(rows);

  const totalAssets = sum(assets);
  const totalLiabilities = sum(liabilities);
  const totalEquity = sum(equity);

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    retainedProfit: netProfit,
    isBalanced:
      Math.abs(totalAssets - (totalLiabilities + totalEquity + netProfit)) <=
      EPSILON,
  };
};

/**
 * A starter chart of accounts. Deliberately short: an owner should be able to
 * read the whole thing, and add to it rather than prune it.
 */
export const DEFAULT_CHART: readonly {
  code: string;
  name: string;
  rootType: AccountRootType;
  accountType:
    | "BANK"
    | "CASH"
    | "RECEIVABLE"
    | "PAYABLE"
    | "STOCK"
    | "FIXED_ASSET"
    | "TAX"
    | "COST_OF_GOODS_SOLD"
    | "DEPRECIATION"
    | "EQUITY"
    | "INCOME_ACCOUNT"
    | "EXPENSE_ACCOUNT"
    | "ROUND_OFF"
    | "OTHER";
  isGroup: boolean;
  parent?: string;
}[] = [
  { code: "1000", name: "Actif", rootType: "ASSET", accountType: "OTHER", isGroup: true },
  { code: "1100", name: "Caisse", rootType: "ASSET", accountType: "CASH", isGroup: false, parent: "1000" },
  { code: "1110", name: "Banque", rootType: "ASSET", accountType: "BANK", isGroup: false, parent: "1000" },
  { code: "1200", name: "Clients", rootType: "ASSET", accountType: "RECEIVABLE", isGroup: false, parent: "1000" },
  { code: "1300", name: "Stocks", rootType: "ASSET", accountType: "STOCK", isGroup: false, parent: "1000" },
  { code: "1400", name: "Matériel de cuisine", rootType: "ASSET", accountType: "FIXED_ASSET", isGroup: false, parent: "1000" },

  { code: "2000", name: "Passif", rootType: "LIABILITY", accountType: "OTHER", isGroup: true },
  { code: "2100", name: "Fournisseurs", rootType: "LIABILITY", accountType: "PAYABLE", isGroup: false, parent: "2000" },
  { code: "2200", name: "TVA à payer", rootType: "LIABILITY", accountType: "TAX", isGroup: false, parent: "2000" },
  { code: "2300", name: "Salaires à payer", rootType: "LIABILITY", accountType: "OTHER", isGroup: false, parent: "2000" },

  { code: "3000", name: "Capitaux propres", rootType: "EQUITY", accountType: "EQUITY", isGroup: true },
  { code: "3100", name: "Capital", rootType: "EQUITY", accountType: "EQUITY", isGroup: false, parent: "3000" },
  { code: "3200", name: "Report à nouveau", rootType: "EQUITY", accountType: "EQUITY", isGroup: false, parent: "3000" },

  { code: "4000", name: "Produits", rootType: "INCOME", accountType: "OTHER", isGroup: true },
  { code: "4100", name: "Ventes de repas", rootType: "INCOME", accountType: "INCOME_ACCOUNT", isGroup: false, parent: "4000" },
  { code: "4200", name: "Ventes de boissons", rootType: "INCOME", accountType: "INCOME_ACCOUNT", isGroup: false, parent: "4000" },
  { code: "4300", name: "Autres produits", rootType: "INCOME", accountType: "INCOME_ACCOUNT", isGroup: false, parent: "4000" },

  { code: "5000", name: "Charges", rootType: "EXPENSE", accountType: "OTHER", isGroup: true },
  { code: "5100", name: "Achats consommés", rootType: "EXPENSE", accountType: "COST_OF_GOODS_SOLD", isGroup: false, parent: "5000" },
  { code: "5200", name: "Salaires", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT", isGroup: false, parent: "5000" },
  { code: "5300", name: "Loyer", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT", isGroup: false, parent: "5000" },
  { code: "5400", name: "Énergie et fluides", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT", isGroup: false, parent: "5000" },
  { code: "5500", name: "Pertes sur stock", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT", isGroup: false, parent: "5000" },
  { code: "5900", name: "Écarts d'arrondi", rootType: "EXPENSE", accountType: "ROUND_OFF", isGroup: false, parent: "5000" },
];

export const ROOT_TYPE_LABEL: Readonly<Record<AccountRootType, string>> = {
  ASSET: "Actif",
  LIABILITY: "Passif",
  EQUITY: "Capitaux propres",
  INCOME: "Produits",
  EXPENSE: "Charges",
};
