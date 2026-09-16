/**
 * What each trade may open in the staff app — and what one person may open,
 * when the manager has ticked boxes for them.
 *
 * The same rule guards the tab bar and every action: an écran that is not in
 * someone's list cannot be reached by typing its address either.
 */

export type StaffScreen = "COMMANDES" | "STOCK" | "PERTES" | "CASSE" | "BASES" | "FICHES";

export type StaffTrade = "WAITER" | "KITCHEN" | "MANAGEMENT";

export interface ScreenDefinition {
  readonly id: StaffScreen;
  readonly label: string;
  /** One line telling the person what this screen is for. */
  readonly purpose: string;
  readonly path: string;
  readonly trades: readonly StaffTrade[];
}

/** Order matters: it is the order of the tab bar. */
export const STAFF_SCREENS: readonly ScreenDefinition[] = [
  {
    id: "COMMANDES",
    label: "Commandes",
    purpose: "Les tickets en cours et le service",
    path: "",
    trades: ["WAITER", "KITCHEN"],
  },
  {
    id: "STOCK",
    label: "Stock du matin",
    purpose: "Voir ce qu'il reste et signaler ce qui ne colle pas",
    path: "/stock",
    trades: ["KITCHEN"],
  },
  {
    id: "PERTES",
    label: "Pertes",
    purpose: "Déclarer ce qui a été jeté, renversé ou refait",
    path: "/pertes",
    trades: ["KITCHEN", "WAITER"],
  },
  {
    id: "CASSE",
    label: "Casse",
    purpose: "Déclarer un verre, une assiette, un couvert cassé",
    path: "/casse",
    trades: ["WAITER"],
  },
  {
    id: "BASES",
    label: "Bases",
    purpose: "Déclarer une production : sauce, fond, pâte",
    path: "/bases",
    trades: ["KITCHEN"],
  },
  {
    id: "FICHES",
    label: "Fiches",
    purpose: "Les quantités de chaque plat, pour cuisiner juste",
    path: "/fiches",
    trades: ["KITCHEN"],
  },
];

const BY_ID = new Map(STAFF_SCREENS.map((screen) => [screen.id, screen]));

export const screenById = (id: string): ScreenDefinition | undefined => BY_ID.get(id as StaffScreen);

const isScreen = (value: string): value is StaffScreen => BY_ID.has(value as StaffScreen);

/** The screens a trade gets when nothing has been ticked for the person. */
export const defaultScreens = (trade: StaffTrade): StaffScreen[] =>
  STAFF_SCREENS.filter((screen) => screen.trades.includes(trade)).map((screen) => screen.id);

/**
 * What this person may open. An explicit list wins over the trade's default,
 * but « Commandes » is never taken away: it is the reason they sign in.
 */
export const screensFor = (staff: { readonly role: StaffTrade; readonly screens?: readonly string[] }): StaffScreen[] => {
  const chosen = (staff.screens ?? []).filter(isScreen);
  if (chosen.length === 0) return defaultScreens(staff.role);
  const ordered = STAFF_SCREENS.filter((screen) => chosen.includes(screen.id)).map((screen) => screen.id);
  return ordered.includes("COMMANDES") ? ordered : ["COMMANDES", ...ordered];
};

export const canUseScreen = (
  staff: { readonly role: StaffTrade; readonly screens?: readonly string[] },
  screen: StaffScreen,
): boolean => screensFor(staff).includes(screen);

/** The tab bar: label, address and whether it is the one being shown. */
export const staffTabs = (
  staff: { readonly role: StaffTrade; readonly screens?: readonly string[] },
  username: string,
): { id: StaffScreen; label: string; purpose: string; href: string }[] =>
  screensFor(staff).map((id) => {
    const screen = BY_ID.get(id) as ScreenDefinition;
    return {
      id,
      label: screen.label,
      purpose: screen.purpose,
      href: `/u/${username}${screen.path}`,
    };
  });
