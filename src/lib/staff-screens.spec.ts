import { describe, expect, it } from "vitest";

import { canUseScreen, defaultScreens, screensFor, staffTabs } from "./staff-screens";

describe("defaultScreens", () => {
  it("gives the kitchen its stock, its losses, its bases and its cards", () => {
    expect(defaultScreens("KITCHEN")).toEqual(["COMMANDES", "PLANNING", "STOCK", "PERTES", "BASES", "FICHES"]);
  });

  it("gives the dining room its service, its rota, its losses and its breakages", () => {
    expect(defaultScreens("WAITER")).toEqual(["COMMANDES", "PLANNING", "PERTES", "CASSE"]);
  });
});

describe("screensFor", () => {
  it("falls back to the trade when the manager ticked nothing", () => {
    expect(screensFor({ role: "WAITER", screens: [] })).toEqual(["COMMANDES", "PLANNING", "PERTES", "CASSE"]);
    expect(screensFor({ role: "WAITER" })).toEqual(["COMMANDES", "PLANNING", "PERTES", "CASSE"]);
  });

  it("obeys the ticked list, in the order of the tab bar", () => {
    expect(screensFor({ role: "WAITER", screens: ["CASSE", "STOCK", "COMMANDES"] })).toEqual([
      "COMMANDES",
      "STOCK",
      "CASSE",
    ]);
  });

  it("never takes the service screen away, even if it was not ticked", () => {
    expect(screensFor({ role: "KITCHEN", screens: ["FICHES"] })).toEqual(["COMMANDES", "FICHES"]);
  });

  it("ignores a screen name that no longer exists", () => {
    expect(screensFor({ role: "KITCHEN", screens: ["ANCIEN_ECRAN", "PERTES"] })).toEqual(["COMMANDES", "PERTES"]);
  });
});

describe("canUseScreen", () => {
  it("lets a cook open the stock and refuses it to a waiter", () => {
    expect(canUseScreen({ role: "KITCHEN" }, "STOCK")).toBe(true);
    expect(canUseScreen({ role: "WAITER" }, "STOCK")).toBe(false);
  });

  it("lets the manager open the stock for one waiter without opening it for all", () => {
    expect(canUseScreen({ role: "WAITER", screens: ["COMMANDES", "PERTES", "CASSE", "STOCK"] }, "STOCK")).toBe(true);
    expect(canUseScreen({ role: "WAITER" }, "STOCK")).toBe(false);
  });
});

describe("staffTabs", () => {
  it("builds the addresses of the restaurant's own staff app", () => {
    expect(staffTabs({ role: "WAITER" }, "chez-viny")).toEqual([
      { id: "COMMANDES", label: "Commandes", purpose: "Les tickets en cours et le service", href: "/u/chez-viny" },
      {
        id: "PLANNING",
        label: "Mon planning",
        purpose: "Vos horaires de la semaine et vos heures",
        href: "/u/chez-viny/planning",
      },
      { id: "PERTES", label: "Pertes", purpose: "Déclarer ce qui a été jeté, renversé ou refait", href: "/u/chez-viny/pertes" },
      { id: "CASSE", label: "Casse", purpose: "Déclarer un verre, une assiette, un couvert cassé", href: "/u/chez-viny/casse" },
    ]);
  });
});
