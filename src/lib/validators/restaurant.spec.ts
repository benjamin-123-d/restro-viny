import { describe, expect, it } from "vitest";

import { updateLegalProfileSchema, updateTaxProfileSchema } from "./restaurant";

describe("updateTaxProfileSchema", () => {
  it("accepts an unregistered profile without a rate", () => {
    expect(
      updateTaxProfileSchema.safeParse({ gstRegistrationType: "UNREGISTERED" })
        .success,
    ).toBe(true);
  });

  it("requires a rate when registered as regular", () => {
    expect(
      updateTaxProfileSchema.safeParse({ gstRegistrationType: "REGULAR" })
        .success,
    ).toBe(false);
  });

  it("coerces the rate and uppercases the GSTIN", () => {
    const parsed = updateTaxProfileSchema.parse({
      gstRegistrationType: "REGULAR",
      serviceGstRate: "18",
      gstin: "22aaaaa0000a1z5",
    });
    expect(parsed.serviceGstRate).toBe(18);
    expect(parsed.gstin).toBe("22AAAAA0000A1Z5");
  });

  it("rejects a malformed GSTIN", () => {
    expect(
      updateTaxProfileSchema.safeParse({
        gstRegistrationType: "REGULAR",
        serviceGstRate: 5,
        gstin: "too-short",
      }).success,
    ).toBe(false);
  });
});

describe("updateLegalProfileSchema", () => {
  const valid = {
    vatTerritory: "METROPOLE",
    legalName: "Le Bistrot SARL",
    siret: "732 829 320 00074",
    vatNumber: "FR44732829320",
    nafCode: "56.10A",
  };

  it("accepts a coherent French legal profile", () => {
    expect(updateLegalProfileSchema.safeParse(valid).success).toBe(true);
  });

  it("lets every mention stay empty until the owner has it", () => {
    expect(updateLegalProfileSchema.safeParse({ vatTerritory: "REUNION" }).success).toBe(true);
  });

  it("refuses a SIRET with a typo, in French", () => {
    const r = updateLegalProfileSchema.safeParse({ ...valid, siret: "73282932000075" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain("SIRET");
  });

  it("refuses a VAT number belonging to another company", () => {
    const r = updateLegalProfileSchema.safeParse({ ...valid, vatNumber: "FR64443061841" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["vatNumber"]);
  });

  it("refuses an unknown territory", () => {
    expect(updateLegalProfileSchema.safeParse({ ...valid, vatTerritory: "MONACO" }).success).toBe(false);
  });
});
