import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Shift, Staff } from "@/generated/prisma/client";

vi.mock("@/repositories/shift.repository", () => ({
  createShift: vi.fn(),
  deleteShift: vi.fn(),
  deleteShiftsBetween: vi.fn(),
  findShiftById: vi.fn(),
  findShiftsBetween: vi.fn(),
  findStaffShiftsBetween: vi.fn(),
  replaceWeek: vi.fn(),
  updateShift: vi.fn(),
}));
vi.mock("@/repositories/staff.repository", () => ({
  findStaffById: vi.fn(),
  findStaffByRestaurant: vi.fn(),
}));

import {
  createShift,
  deleteShiftsBetween,
  findShiftById,
  findShiftsBetween,
  replaceWeek,
  updateShift,
} from "@/repositories/shift.repository";
import { findStaffById, findStaffByRestaurant } from "@/repositories/staff.repository";

import {
  clearWeek,
  copyWeek,
  getMonthHours,
  getWeek,
  saveShift,
  SHIFT_FORBIDDEN,
  STAFF_NOT_IN_RESTAURANT,
} from "./planning.service";

const ctx = { restaurantId: "res_1", userId: "u1" };

const makeStaff = (o: Partial<Staff> = {}): Staff =>
  ({
    id: "st1",
    restaurantId: "res_1",
    employeeCode: "E1",
    name: "Awa",
    role: "WAITER",
    status: "ACTIVE",
    photoUrl: null,
    weeklyHours: 35,
    screens: [],
    deletedAt: null,
    ...o,
  }) as Staff;

const makeShift = (o: Partial<Shift> = {}): Shift =>
  ({
    id: "sh1",
    restaurantId: "res_1",
    staffId: "st1",
    day: "2026-09-14",
    kind: "TRAVAIL",
    startMinute: 660,
    endMinute: 900,
    breakMinutes: 0,
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...o,
  }) as Shift;

beforeEach(() => {
  vi.mocked(findStaffByRestaurant).mockResolvedValue([makeStaff()]);
  vi.mocked(findShiftsBetween).mockResolvedValue([]);
  vi.mocked(findStaffById).mockResolvedValue(makeStaff());
});

describe("getWeek", () => {
  it("rend la semaine du lundi, quel que soit le jour demandé", async () => {
    const week = await getWeek(ctx, "2026-09-17");
    expect(week.monday).toBe("2026-09-14");
    expect(week.days).toHaveLength(7);
  });

  it("range chaque service dans sa colonne et additionne les heures", async () => {
    vi.mocked(findShiftsBetween).mockResolvedValueOnce([
      makeShift({ id: "a", day: "2026-09-14" }),
      makeShift({ id: "b", day: "2026-09-14", startMinute: 1110, endMinute: 1380 }),
      makeShift({ id: "c", day: "2026-09-16" }),
    ]);
    const week = await getWeek(ctx, "2026-09-14");
    const row = week.rows[0];
    expect(row.days[0]).toHaveLength(2); // la coupure du lundi
    expect(row.days[1]).toHaveLength(0);
    expect(row.days[2]).toHaveLength(1);
    expect(row.workedMinutes).toBe(240 + 270 + 240);
    expect(row.workedDays).toBe(2);
  });

  it("garde les personnes en congé sur le planning", async () => {
    vi.mocked(findStaffByRestaurant).mockResolvedValue([makeStaff({ status: "ON_LEAVE" })]);
    const week = await getWeek(ctx, "2026-09-14");
    expect(week.rows).toHaveLength(1);
    expect(week.rows[0].person.onLeave).toBe(true);
  });

  it("retire celles qui ne font plus partie de l'équipe", async () => {
    vi.mocked(findStaffByRestaurant).mockResolvedValue([makeStaff({ status: "INACTIVE" })]);
    expect((await getWeek(ctx, "2026-09-14")).rows).toHaveLength(0);
  });

  it("dit si la semaine précédente peut être recopiée", async () => {
    vi.mocked(findShiftsBetween).mockResolvedValueOnce([]).mockResolvedValueOnce([makeShift()]);
    expect((await getWeek(ctx, "2026-09-14")).previousWeekHasShifts).toBe(true);
  });
});

describe("saveShift", () => {
  it("refuse quelqu'un d'un autre restaurant", async () => {
    vi.mocked(findStaffById).mockResolvedValue(makeStaff({ restaurantId: "autre" }));
    await expect(
      saveShift(ctx, { staffId: "st1", day: "2026-09-14", kind: "TRAVAIL", startMinute: 600, endMinute: 900, breakMinutes: 0 }),
    ).rejects.toThrow(STAFF_NOT_IN_RESTAURANT);
  });

  it("efface les horaires d'un jour de repos", async () => {
    vi.mocked(createShift).mockResolvedValue(makeShift({ kind: "REPOS", startMinute: null, endMinute: null }));
    await saveShift(ctx, { staffId: "st1", day: "2026-09-14", kind: "REPOS", startMinute: 600, endMinute: 900, breakMinutes: 30 });
    expect(vi.mocked(createShift).mock.calls[0][1]).toMatchObject({
      kind: "REPOS",
      startMinute: null,
      endMinute: null,
      breakMinutes: 0,
    });
  });

  it("modifie un service existant sans toucher à la personne ni au jour", async () => {
    vi.mocked(findShiftById).mockResolvedValue(makeShift());
    vi.mocked(updateShift).mockResolvedValue(makeShift({ endMinute: 960 }));
    await saveShift(ctx, {
      id: "sh1",
      staffId: "st1",
      day: "2026-09-14",
      kind: "TRAVAIL",
      startMinute: 660,
      endMinute: 960,
      breakMinutes: 0,
    });
    const patch = vi.mocked(updateShift).mock.calls[0][1];
    expect(patch).not.toHaveProperty("staffId");
    expect(patch).not.toHaveProperty("day");
  });

  it("refuse un service d'un autre restaurant", async () => {
    vi.mocked(findShiftById).mockResolvedValue(makeShift({ restaurantId: "autre" }));
    await expect(
      saveShift(ctx, { id: "sh1", staffId: "st1", day: "2026-09-14", kind: "TRAVAIL", startMinute: 660, endMinute: 900, breakMinutes: 0 }),
    ).rejects.toThrow(SHIFT_FORBIDDEN);
  });
});

describe("copyWeek", () => {
  it("décale chaque jour d'une semaine et remplace la cible", async () => {
    vi.mocked(findShiftsBetween).mockResolvedValue([
      makeShift({ day: "2026-09-14" }),
      makeShift({ id: "sh2", day: "2026-09-20" }),
    ]);
    vi.mocked(replaceWeek).mockResolvedValue(2);

    const result = await copyWeek(ctx, { fromMonday: "2026-09-14", toMonday: "2026-09-21" });

    expect(result.copied).toBe(2);
    const [, from, to, rows] = vi.mocked(replaceWeek).mock.calls[0];
    expect(from).toBe("2026-09-21");
    expect(to).toBe("2026-09-27");
    expect(rows.map((row) => row.day)).toEqual(["2026-09-21", "2026-09-27"]);
  });
});

describe("clearWeek", () => {
  it("vide les sept jours de la semaine", async () => {
    vi.mocked(deleteShiftsBetween).mockResolvedValue({ count: 3 });
    const result = await clearWeek(ctx, { monday: "2026-09-16" });
    expect(result.removed).toBe(3);
    expect(vi.mocked(deleteShiftsBetween).mock.calls[0].slice(1)).toEqual(["2026-09-14", "2026-09-20"]);
  });
});

describe("getMonthHours", () => {
  it("compte les heures supplémentaires semaine par semaine, pas sur le mois", async () => {
    // 45 h une semaine, 25 h la suivante : 10 h supplémentaires, pas zéro.
    const long = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"].map((day, index) =>
      makeShift({ id: `l${index}`, day, startMinute: 540, endMinute: 1080 }), // 9 h
    );
    const short = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"].map((day, index) =>
      makeShift({ id: `s${index}`, day, startMinute: 600, endMinute: 900 }), // 5 h
    );
    vi.mocked(findShiftsBetween).mockResolvedValue([...long, ...short]);

    const month = await getMonthHours(ctx, "2026-09");

    expect(month.rows[0].workedMinutes).toBe(45 * 60 + 25 * 60);
    expect(month.rows[0].overtimeMinutes).toBe(10 * 60);
  });
});
