import { describe, expect, it } from "vitest";

import {
  alertSignatureMap,
  newIds,
  newOrderAlerts,
  newOrderPhrase,
  orderReadyPhrase,
  pickFrenchVoice,
  selfOrderAlertPhrase,
  type SpeakableOrder,
} from "./announce";

const voice = (lang: string, name = lang): SpeechSynthesisVoice =>
  ({
    lang,
    name,
    default: false,
    localService: true,
    voiceURI: name,
  }) as SpeechSynthesisVoice;

describe("pickFrenchVoice", () => {
  it("prefers an exact fr-FR voice", () => {
    const v = pickFrenchVoice([voice("en-US"), voice("fr-CA"), voice("fr-FR")]);
    expect(v?.lang).toBe("fr-FR");
  });

  it("falls back to any fr-* voice", () => {
    expect(pickFrenchVoice([voice("en-US"), voice("fr-BE")])?.lang).toBe("fr-BE");
  });

  it("returns null when no French voice exists", () => {
    expect(pickFrenchVoice([voice("en-US"), voice("hi-IN")])).toBeNull();
  });
});

describe("newIds", () => {
  it("returns only ids not already seen", () => {
    expect(newIds(new Set(["a", "b"]), ["b", "c", "d"])).toEqual(["c", "d"]);
  });

  it("returns empty when nothing is new", () => {
    expect(newIds(new Set(["a"]), ["a"])).toEqual([]);
  });
});

const order = (over: Partial<SpeakableOrder> = {}): SpeakableOrder => ({
  orderType: "DINE_IN",
  tableLabel: "T1",
  orderNumber: 7,
  ...over,
});

describe("newOrderPhrase", () => {
  it("names the table for dine-in", () => {
    expect(newOrderPhrase(order())).toBe("Nouvelle commande, table T1");
  });

  it("uses a generic phrase for takeaway", () => {
    expect(
      newOrderPhrase(order({ orderType: "TAKEAWAY", tableLabel: null })),
    ).toBe("Nouvelle commande à emporter");
  });

  it("uses a delivery phrase for delivery", () => {
    expect(
      newOrderPhrase(order({ orderType: "DELIVERY", tableLabel: null })),
    ).toBe("Nouvelle commande en livraison");
  });
});

describe("orderReadyPhrase", () => {
  it("announces the table for dine-in", () => {
    expect(orderReadyPhrase(order())).toBe("Table T1, la commande est prête");
  });

  it("announces the number for takeaway", () => {
    expect(
      orderReadyPhrase(order({ orderType: "TAKEAWAY", tableLabel: null })),
    ).toBe("Commande à emporter numéro 7 prête");
  });
});

describe("selfOrderAlertPhrase", () => {
  it("names the table for dine-in", () => {
    expect(selfOrderAlertPhrase(order())).toBe("Commande client, table T1");
  });

  it("uses a generic phrase without a table", () => {
    expect(
      selfOrderAlertPhrase(order({ orderType: "TAKEAWAY", tableLabel: null })),
    ).toBe("Nouvelle commande client");
  });
});

describe("newOrderAlerts", () => {
  it("flags a brand-new staff order (not self-order)", () => {
    const alerts = newOrderAlerts(new Map(), [{ id: "o1", selfOrderLines: 0 }]);
    expect(alerts).toEqual([{ id: "o1", isSelfOrder: false, isAddOn: false }]);
  });

  it("flags a brand-new self-order", () => {
    const alerts = newOrderAlerts(new Map(), [{ id: "o1", selfOrderLines: 2 }]);
    expect(alerts).toEqual([{ id: "o1", isSelfOrder: true, isAddOn: false }]);
  });

  it("flags a guest add-on when self-order lines grow on a seen order", () => {
    const prev = new Map([["o1", 1]]);
    const alerts = newOrderAlerts(prev, [{ id: "o1", selfOrderLines: 3 }]);
    expect(alerts).toEqual([{ id: "o1", isSelfOrder: true, isAddOn: true }]);
  });

  it("stays silent when a seen order's self-order lines are unchanged", () => {
    const prev = new Map([["o1", 2]]);
    expect(newOrderAlerts(prev, [{ id: "o1", selfOrderLines: 2 }])).toEqual([]);
  });

  it("stays silent for a staff add-on (self-order count unchanged)", () => {
    const prev = new Map([["o1", 0]]);
    expect(newOrderAlerts(prev, [{ id: "o1", selfOrderLines: 0 }])).toEqual([]);
  });

  it("builds a seedable signature map", () => {
    const map = alertSignatureMap([
      { id: "o1", selfOrderLines: 1 },
      { id: "o2", selfOrderLines: 0 },
    ]);
    expect(map.get("o1")).toBe(1);
    expect(map.get("o2")).toBe(0);
  });
});
