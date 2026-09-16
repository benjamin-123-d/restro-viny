import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  dayLabel,
  dayLong,
  hoursText,
  isDay,
  isShiftKind,
  minutesToText,
  mondayOf,
  monthDays,
  monthGrid,
  monthLabel,
  overtimeMinutes,
  shiftLabel,
  shiftMinutes,
  textToMinutes,
  totalsByStaff,
  totalsFor,
  weekDays,
  weekLabel,
  weekWarnings,
  weekdayOf,
  type StaffShift,
} from "./planning";

describe("les jours", () => {
  it("reconnaît un jour valide", () => {
    expect(isDay("2026-09-16")).toBe(true);
    expect(isDay("16/09/2026")).toBe(false);
    expect(isDay("2026-13-01")).toBe(false);
  });

  it("compte les jours sans se tromper au changement d'heure", () => {
    // Dernier dimanche d'octobre : la nuit où les horloges reculent d'une heure.
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
    // Et au printemps, la nuit où elles avancent.
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
  });

  it("passe d'un mois et d'une année à l'autre", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("numérote les jours du lundi au dimanche", () => {
    expect(weekdayOf("2026-09-14")).toBe(1);
    expect(weekdayOf("2026-09-20")).toBe(7);
  });

  it("trouve le lundi de la semaine", () => {
    expect(mondayOf("2026-09-16")).toBe("2026-09-14");
    expect(mondayOf("2026-09-14")).toBe("2026-09-14");
    expect(mondayOf("2026-09-20")).toBe("2026-09-14");
  });

  it("donne les sept jours de la semaine", () => {
    expect(weekDays("2026-09-14")).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
  });

  it("écrit les jours en français", () => {
    expect(dayLabel("2026-09-16")).toBe("mer. 16");
    expect(dayLong("2026-09-16")).toBe("mercredi 16 septembre");
    expect(weekLabel("2026-09-14")).toBe("semaine du 14 au 20 septembre");
    expect(weekLabel("2026-09-28")).toBe("semaine du 28 septembre au 4 octobre");
    expect(monthLabel("2026-09")).toBe("septembre 2026");
  });
});

describe("les mois", () => {
  it("compte les jours du mois, février compris", () => {
    expect(monthDays("2026-09")).toHaveLength(30);
    expect(monthDays("2026-02")).toHaveLength(28);
    expect(monthDays("2028-02")).toHaveLength(29);
  });

  it("change de mois et d'année", () => {
    expect(addMonths("2026-09", 1)).toBe("2026-10");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("dessine un calendrier en semaines entières", () => {
    const grid = monthGrid("2026-09");
    expect(grid.length % 7).toBe(0);
    expect(grid[0]).toBe("2026-08-31"); // le lundi avant le 1er
    expect(grid[grid.length - 1]).toBe("2026-10-04"); // le dimanche après le 30
    expect(grid).toContain("2026-09-01");
    expect(grid).toContain("2026-09-30");
  });
});

describe("les heures", () => {
  it("lit une heure écrite de plusieurs façons", () => {
    expect(textToMinutes("18:30")).toBe(1110);
    expect(textToMinutes("18h30")).toBe(1110);
    expect(textToMinutes("9:05")).toBe(545);
    expect(textToMinutes("18h")).toBe(1080);
    expect(textToMinutes("25:00")).toBeNull();
    expect(textToMinutes("bonjour")).toBeNull();
  });

  it("réécrit une heure", () => {
    expect(minutesToText(1110)).toBe("18:30");
    expect(minutesToText(545)).toBe("09:05");
    expect(minutesToText(0)).toBe("00:00");
  });

  it("dit une durée comme on la dit à l'oral", () => {
    expect(hoursText(450)).toBe("7 h 30");
    expect(hoursText(480)).toBe("8 h");
    expect(hoursText(0)).toBe("0 h");
    expect(hoursText(-90)).toBe("-1 h 30");
  });
});

describe("la durée d'un service", () => {
  const shift = (start: number | null, end: number | null, breakMinutes = 0, kind = "TRAVAIL" as const) => ({
    kind,
    startMinute: start,
    endMinute: end,
    breakMinutes,
  });

  it("compte un service normal", () => {
    expect(shiftMinutes(shift(660, 900))).toBe(240); // 11:00 → 15:00
  });

  it("compte un service qui finit après minuit", () => {
    expect(shiftMinutes(shift(1110, 60))).toBe(390); // 18:30 → 01:00
  });

  it("retire la pause", () => {
    expect(shiftMinutes(shift(660, 900, 30))).toBe(210);
  });

  it("ne compte pas un congé, même avec des heures", () => {
    expect(shiftMinutes(shift(660, 900, 0, "TRAVAIL"))).toBe(240);
    expect(shiftMinutes({ kind: "CONGE", startMinute: 660, endMinute: 900, breakMinutes: 0 })).toBe(0);
  });

  it("ne compte rien sans horaires", () => {
    expect(shiftMinutes(shift(null, null))).toBe(0);
  });

  it("écrit le service ou le motif", () => {
    expect(shiftLabel(shift(1110, 60))).toBe("18:30 – 01:00");
    expect(shiftLabel({ kind: "CONGE", startMinute: null, endMinute: null, breakMinutes: 0 })).toBe("Congé");
  });
});

describe("les totaux de la semaine", () => {
  const shifts: StaffShift[] = [
    { staffId: "a", day: "2026-09-14", kind: "TRAVAIL", startMinute: 660, endMinute: 900, breakMinutes: 0 },
    { staffId: "a", day: "2026-09-14", kind: "TRAVAIL", startMinute: 1110, endMinute: 1380, breakMinutes: 0 },
    { staffId: "a", day: "2026-09-15", kind: "REPOS", startMinute: null, endMinute: null, breakMinutes: 0 },
    { staffId: "b", day: "2026-09-14", kind: "CONGE", startMinute: null, endMinute: null, breakMinutes: 0 },
  ];

  it("additionne la coupure du midi et du soir sur un seul jour travaillé", () => {
    const totals = totalsByStaff(shifts);
    expect(totalsFor(totals, "a")).toEqual({
      workedMinutes: 240 + 270,
      workedDays: 1,
      restDays: 1,
      leaveDays: 0,
    });
  });

  it("compte les congés à part", () => {
    expect(totalsFor(totalsByStaff(shifts), "b")).toEqual({
      workedMinutes: 0,
      workedDays: 0,
      restDays: 0,
      leaveDays: 1,
    });
  });

  it("rend zéro pour quelqu'un sans service", () => {
    expect(totalsFor(totalsByStaff(shifts), "inconnu").workedMinutes).toBe(0);
  });
});

describe("les heures supplémentaires", () => {
  it("compte ce qui dépasse le contrat", () => {
    expect(overtimeMinutes(39 * 60, 35)).toBe(4 * 60);
    expect(overtimeMinutes(30 * 60, 35)).toBe(0);
    expect(overtimeMinutes(45 * 60, null)).toBe(0);
  });
});

describe("les avertissements avant de publier", () => {
  const people = [{ id: "a", name: "Awa", weeklyHours: 35 }];

  const week = (kind: "TRAVAIL" | "REPOS", days: string[]): StaffShift[] =>
    days.map((day) => ({ staffId: "a", day, kind, startMinute: 600, endMinute: 1080, breakMinutes: 0 }));

  it("alerte au-dessus de 48 heures", () => {
    const totals = totalsByStaff(week("TRAVAIL", weekDays("2026-09-14")));
    expect(weekWarnings(people, totals).some((w) => w.message.includes("maximum légal"))).toBe(true);
  });

  it("alerte quand personne ne se repose de la semaine", () => {
    const totals = totalsByStaff(week("TRAVAIL", weekDays("2026-09-14")));
    expect(weekWarnings(people, totals).some((w) => w.message.includes("repos hebdomadaire"))).toBe(true);
  });

  it("alerte quand le contrat n'est pas rempli", () => {
    const totals = totalsByStaff(week("TRAVAIL", ["2026-09-14", "2026-09-15"]));
    expect(weekWarnings(people, totals).some((w) => w.message.includes("contrat"))).toBe(true);
  });

  it("ne dit rien sur une semaine normale", () => {
    const shifts: StaffShift[] = [
      ...week("TRAVAIL", ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"]),
      ...week("REPOS", ["2026-09-19", "2026-09-20"]).map((s) => ({ ...s, startMinute: null, endMinute: null })),
    ];
    expect(weekWarnings(people, totalsByStaff(shifts))).toEqual([]);
  });
});

describe("les motifs", () => {
  it("valide un motif connu", () => {
    expect(isShiftKind("TRAVAIL")).toBe(true);
    expect(isShiftKind("VACANCES")).toBe(false);
  });
});
