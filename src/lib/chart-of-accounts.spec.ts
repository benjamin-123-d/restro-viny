import { describe, expect, it } from "vitest";

import {
  ACCOUNT_BY_CATEGORY,
  accountClass,
  auxiliaryCode,
  DEFAULT_ACCOUNTS,
  FRENCH_CHART,
  isAccountCode,
  isCustomerAccount,
  isExpenseAccount,
  isIncomeAccount,
  isPrepaidExpense,
  isSupplierAccount,
  isVatCollected,
  isVatDeductible,
  rootTypeForCode,
  subTypeForCode,
} from "./chart-of-accounts";

describe("un numéro de compte", () => {
  it("fait de trois à huit chiffres", () => {
    expect(isAccountCode("601")).toBe(true);
    expect(isAccountCode("601000")).toBe(true);
    expect(isAccountCode("60")).toBe(false);
    expect(isAccountCode("60A000")).toBe(false);
    expect(isAccountCode("")).toBe(false);
  });

  it("porte sa classe dans son premier chiffre", () => {
    expect(accountClass("601000")).toBe(6);
    expect(accountClass("445661")).toBe(4);
    expect(accountClass("706000")).toBe(7);
  });
});

describe("ce qu'un numéro veut dire", () => {
  it("reconnaît les tiers", () => {
    expect(isSupplierAccount("401000")).toBe(true);
    expect(isSupplierAccount("411000")).toBe(false);
    expect(isCustomerAccount("411000")).toBe(true);
  });

  it("distingue la TVA déductible de la TVA collectée", () => {
    expect(isVatDeductible("445661")).toBe(true);
    expect(isVatCollected("445661")).toBe(false);
    expect(isVatCollected("445710")).toBe(true);
    expect(isVatDeductible("445710")).toBe(false);
  });

  it("reconnaît les charges, les produits et les charges constatées d'avance", () => {
    expect(isExpenseAccount("601000")).toBe(true);
    expect(isIncomeAccount("706000")).toBe(true);
    expect(isExpenseAccount("706000")).toBe(false);
    expect(isPrepaidExpense("486000")).toBe(true);
  });
});

describe("la nature d'un compte créé à la main", () => {
  it("devine le bon côté pour un compte de tiers", () => {
    expect(rootTypeForCode("401000")).toBe("LIABILITY");
    expect(rootTypeForCode("411000")).toBe("ASSET");
    expect(rootTypeForCode("445661")).toBe("ASSET");
    expect(rootTypeForCode("445710")).toBe("LIABILITY");
    expect(rootTypeForCode("486000")).toBe("ASSET");
  });

  it("devine la classe des charges, produits, trésorerie et immobilisations", () => {
    expect(rootTypeForCode("606300")).toBe("EXPENSE");
    expect(rootTypeForCode("707000")).toBe("INCOME");
    expect(rootTypeForCode("512000")).toBe("ASSET");
    expect(rootTypeForCode("215400")).toBe("ASSET");
  });

  it("devine le sous-type", () => {
    expect(subTypeForCode("401000")).toBe("PAYABLE");
    expect(subTypeForCode("411000")).toBe("RECEIVABLE");
    expect(subTypeForCode("445661")).toBe("TAX");
    expect(subTypeForCode("512000")).toBe("BANK");
    expect(subTypeForCode("530000")).toBe("CASH");
    expect(subTypeForCode("601000")).toBe("COST_OF_GOODS_SOLD");
    expect(subTypeForCode("626000")).toBe("EXPENSE_ACCOUNT");
    expect(subTypeForCode("706000")).toBe("INCOME_ACCOUNT");
  });
});

describe("le plan semé", () => {
  it("n'a aucun numéro en double", () => {
    const codes = FRENCH_CHART.map((account) => account.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("n'a que des numéros valides", () => {
    expect(FRENCH_CHART.every((account) => isAccountCode(account.code))).toBe(true);
  });

  it("contient tous les comptes dont la ventilation automatique a besoin", () => {
    const codes = new Set(FRENCH_CHART.map((account) => account.code));
    for (const code of Object.values(DEFAULT_ACCOUNTS)) expect(codes).toContain(code);
  });

  it("contient le compte de chaque catégorie d'achat", () => {
    const codes = new Set(FRENCH_CHART.map((account) => account.code));
    for (const code of Object.values(ACCOUNT_BY_CATEGORY)) expect(codes).toContain(code);
  });

  it("annonce une nature cohérente avec le numéro", () => {
    for (const account of FRENCH_CHART) {
      expect(account.rootType).toBe(rootTypeForCode(account.code));
    }
  });
});

describe("le code auxiliaire", () => {
  it("compose la lettre du côté et le début du nom", () => {
    expect(auxiliaryCode("F", "AUCHAN")).toBe("FAUCH01");
    expect(auxiliaryCode("C", "Mairie de Cholet")).toBe("CMAIR01");
  });

  it("ignore les accents, les espaces et la ponctuation", () => {
    expect(auxiliaryCode("F", "Élite Café")).toBe("FELIT01");
    expect(auxiliaryCode("F", "3 KOD")).toBe("F3KOD01");
  });

  it("complète un nom trop court et numérote les homonymes", () => {
    expect(auxiliaryCode("F", "OK")).toBe("FOKXX01");
    expect(auxiliaryCode("F", "AUCHAN", 2)).toBe("FAUCH02");
  });
});
