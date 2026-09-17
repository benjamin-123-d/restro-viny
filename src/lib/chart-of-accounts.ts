/**
 * Le plan comptable — the chart of accounts a French restaurant starts from.
 *
 * Two things live here, and nothing else: the list of accounts the restaurant
 * is seeded with, and the rules that read meaning out of an account number.
 *
 * The second part matters more than the first. The accountant may create any
 * account at any moment, so nothing can rely on a fixed list: what a number
 * *means* has to be derived from the number itself. In the French plan
 * comptable général the first digit is the class — 6 is a charge, 7 a product,
 * 401 a supplier, 4456 deductible VAT — and that is a rule, not a convention
 * this application invented.
 */

import type { PurchaseCategory } from "@/lib/purchase-categories";

export type AccountRoot = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

export type AccountSub =
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

export interface ChartAccount {
  readonly code: string;
  readonly name: string;
  readonly rootType: AccountRoot;
  readonly accountType: AccountSub;
}

/** An account number: three to eight digits, as the plan comptable writes them. */
export const isAccountCode = (code: string): boolean => /^\d{3,8}$/.test(code.trim());

/** The class of an account — its first digit — which carries its nature. */
export const accountClass = (code: string): number => Number(code.trim().charAt(0));

const startsWith = (code: string, prefix: string): boolean => code.trim().startsWith(prefix);

export const isSupplierAccount = (code: string): boolean => startsWith(code, "401");
export const isCustomerAccount = (code: string): boolean => startsWith(code, "411");
export const isVatDeductible = (code: string): boolean => startsWith(code, "4456");
export const isVatCollected = (code: string): boolean => startsWith(code, "4457");
export const isExpenseAccount = (code: string): boolean => accountClass(code) === 6;
export const isIncomeAccount = (code: string): boolean => accountClass(code) === 7;
/** Charges constatées d'avance — the account the CCA box moves a charge to. */
export const isPrepaidExpense = (code: string): boolean => startsWith(code, "486");

/**
 * What an account number means, for an account the accountant types in that no
 * list knows about. Wrong guesses are harmless — the accountant can correct the
 * nature — but a sensible default spares them the question nine times out of ten.
 */
export const rootTypeForCode = (code: string): AccountRoot => {
  switch (accountClass(code)) {
    case 1:
      return "EQUITY";
    case 2:
    case 3:
    case 5:
      return "ASSET";
    case 4:
      // Class 4 is « tiers »: what is owed to us is an asset, what we owe a
      // liability. Customers and deductible VAT sit on the asset side.
      return isCustomerAccount(code) || isVatDeductible(code) || isPrepaidExpense(code) ? "ASSET" : "LIABILITY";
    case 6:
      return "EXPENSE";
    case 7:
      return "INCOME";
    default:
      return "ASSET";
  }
};

export const subTypeForCode = (code: string): AccountSub => {
  if (isSupplierAccount(code)) return "PAYABLE";
  if (isCustomerAccount(code)) return "RECEIVABLE";
  if (startsWith(code, "445") || startsWith(code, "4455")) return "TAX";
  if (startsWith(code, "512")) return "BANK";
  if (startsWith(code, "53")) return "CASH";
  if (accountClass(code) === 2) return "FIXED_ASSET";
  if (accountClass(code) === 3) return "STOCK";
  if (startsWith(code, "601") || startsWith(code, "602") || startsWith(code, "607")) return "COST_OF_GOODS_SOLD";
  if (accountClass(code) === 6) return "EXPENSE_ACCOUNT";
  if (accountClass(code) === 7) return "INCOME_ACCOUNT";
  return "OTHER";
};

/**
 * The accounts a restaurant is seeded with. Deliberately short: a plan nobody
 * reads is worse than a plan of thirty lines the accountant extends as needed.
 */
export const FRENCH_CHART: readonly ChartAccount[] = [
  // --- classe 2 : immobilisations
  { code: "215400", name: "Matériel de cuisine et industriel", rootType: "ASSET", accountType: "FIXED_ASSET" },
  { code: "218300", name: "Matériel de bureau et informatique", rootType: "ASSET", accountType: "FIXED_ASSET" },

  // --- classe 4 : tiers
  { code: "401000", name: "Fournisseurs", rootType: "LIABILITY", accountType: "PAYABLE" },
  { code: "411000", name: "Clients", rootType: "ASSET", accountType: "RECEIVABLE" },
  { code: "421000", name: "Personnel — rémunérations dues", rootType: "LIABILITY", accountType: "OTHER" },
  { code: "431000", name: "Sécurité sociale", rootType: "LIABILITY", accountType: "OTHER" },
  { code: "445510", name: "TVA à décaisser", rootType: "LIABILITY", accountType: "TAX" },
  { code: "445620", name: "TVA déductible sur immobilisations", rootType: "ASSET", accountType: "TAX" },
  { code: "445661", name: "TVA déductible sur autres biens et services", rootType: "ASSET", accountType: "TAX" },
  { code: "445710", name: "TVA collectée", rootType: "LIABILITY", accountType: "TAX" },
  { code: "486000", name: "Charges constatées d'avance", rootType: "ASSET", accountType: "OTHER" },

  // --- classe 5 : trésorerie
  { code: "512000", name: "Banque", rootType: "ASSET", accountType: "BANK" },
  { code: "530000", name: "Caisse", rootType: "ASSET", accountType: "CASH" },

  // --- classe 6 : charges
  { code: "601000", name: "Achats de denrées alimentaires", rootType: "EXPENSE", accountType: "COST_OF_GOODS_SOLD" },
  { code: "602600", name: "Emballages", rootType: "EXPENSE", accountType: "COST_OF_GOODS_SOLD" },
  { code: "606100", name: "Eau, gaz, électricité", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT" },
  { code: "606300", name: "Produits d'entretien et petit équipement", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT" },
  { code: "606400", name: "Fournitures administratives", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT" },
  { code: "607000", name: "Achats de boissons", rootType: "EXPENSE", accountType: "COST_OF_GOODS_SOLD" },
  { code: "613200", name: "Loyers", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT" },
  { code: "615000", name: "Entretien et réparations", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT" },
  { code: "616000", name: "Assurances", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT" },
  { code: "622600", name: "Honoraires", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT" },
  { code: "623000", name: "Publicité et communication", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT" },
  { code: "626000", name: "Téléphone et internet", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT" },
  { code: "627000", name: "Services bancaires", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT" },
  { code: "635100", name: "Impôts et taxes", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT" },
  { code: "641000", name: "Salaires", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT" },
  { code: "645000", name: "Charges sociales", rootType: "EXPENSE", accountType: "EXPENSE_ACCOUNT" },

  // --- classe 7 : produits
  { code: "706000", name: "Restauration sur place", rootType: "INCOME", accountType: "INCOME_ACCOUNT" },
  { code: "707000", name: "Vente à emporter et boissons", rootType: "INCOME", accountType: "INCOME_ACCOUNT" },
];

/** The accounts the automatic ventilation reaches for. */
export const DEFAULT_ACCOUNTS = {
  supplier: "401000",
  customer: "411000",
  vatDeductible: "445661",
  vatCollected: "445710",
  expense: "601000",
  income: "706000",
  prepaidExpense: "486000",
} as const;

/**
 * Which charge account a purchase category lands on. It is only a first
 * proposal: what the accountant actually chooses is remembered against the
 * supplier, and that memory wins next time.
 */
export const ACCOUNT_BY_CATEGORY: Readonly<Record<PurchaseCategory, string>> = {
  DENREES: "601000",
  BOISSONS: "607000",
  ENTRETIEN: "606300",
  MATERIEL: "606300",
  EMBALLAGES: "602600",
  AUTRE: "606400",
};

/**
 * The auxiliary code of a third party — « FAUC01 » for Auchan. A letter for the
 * side (F for fournisseur, C for client), then the first letters of the name,
 * then a rank when two names collide.
 */
export const auxiliaryCode = (side: "F" | "C", name: string, rank = 1): string => {
  const letters = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(4, "X");
  return `${side}${letters}${String(rank).padStart(2, "0")}`;
};
