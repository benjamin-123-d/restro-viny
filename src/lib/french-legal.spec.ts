import { describe, expect, it } from "vitest";

import {
  formatSiret,
  isValidNafCode,
  isValidSiret,
  isValidVatNumber,
  normaliseDigits,
  vatNumberFromSiret,
} from "./french-legal";

describe("isValidSiret", () => {
  it("accepts a SIRET whose Luhn checksum is right", () => {
    expect(isValidSiret("73282932000074")).toBe(true);
  });

  it("accepts the spaces people type when copying from a Kbis", () => {
    expect(isValidSiret("732 829 320 00074")).toBe(true);
  });

  it("rejects a SIRET with one wrong digit", () => {
    expect(isValidSiret("73282932000075")).toBe(false);
  });

  it("rejects anything that is not 14 digits", () => {
    expect(isValidSiret("7328293200007")).toBe(false);
    expect(isValidSiret("7328293200007A")).toBe(false);
  });

  it("applies La Poste's own rule: digits add up to a multiple of 5", () => {
    expect(isValidSiret("35600000049837")).toBe(true);
    expect(isValidSiret("35600000049838")).toBe(false);
  });
});

describe("vatNumberFromSiret", () => {
  it("derives the intra-community VAT number from the SIREN", () => {
    expect(vatNumberFromSiret("73282932000074")).toBe("FR44732829320");
  });

  it("returns null when the SIRET is not usable", () => {
    expect(vatNumberFromSiret("123")).toBeNull();
  });
});

describe("isValidVatNumber", () => {
  it("accepts a French number whose key matches its SIREN", () => {
    expect(isValidVatNumber("FR44732829320")).toBe(true);
    expect(isValidVatNumber("fr 44 732 829 320")).toBe(true);
  });

  it("rejects a French number with the wrong key", () => {
    expect(isValidVatNumber("FR45732829320")).toBe(false);
  });

  it("rejects a malformed number", () => {
    expect(isValidVatNumber("FR4473282932")).toBe(false);
  });
});

describe("isValidNafCode", () => {
  it("accepts restaurant activity codes with or without the dot", () => {
    expect(isValidNafCode("56.10A")).toBe(true);
    expect(isValidNafCode("5610C")).toBe(true);
  });

  it("rejects a code without its letter", () => {
    expect(isValidNafCode("56.10")).toBe(false);
  });
});

describe("formatting", () => {
  it("groups a SIRET as printed on a Kbis", () => {
    expect(formatSiret("73282932000074")).toBe("732 829 320 00074");
  });

  it("keeps only digits", () => {
    expect(normaliseDigits(" 732-829 320 ")).toBe("732829320");
  });
});
