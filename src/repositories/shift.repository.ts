import type { Shift, ShiftKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface ShiftWriteData {
  staffId: string;
  day: string;
  kind: ShiftKind;
  startMinute: number | null;
  endMinute: number | null;
  breakMinutes: number;
  note: string | null;
}

/**
 * Every shift of a window, oldest first. Days are « YYYY-MM-DD » strings, so a
 * range is a plain string comparison — and it sorts in calendar order.
 */
export const findShiftsBetween = (
  restaurantId: string,
  from: string,
  to: string,
): Promise<Shift[]> =>
  prisma.shift.findMany({
    where: { restaurantId, day: { gte: from, lte: to } },
    orderBy: [{ day: "asc" }, { startMinute: "asc" }],
  });

/** One person's shifts — what they see when they open « Mon planning ». */
export const findStaffShiftsBetween = (
  staffId: string,
  from: string,
  to: string,
): Promise<Shift[]> =>
  prisma.shift.findMany({
    where: { staffId, day: { gte: from, lte: to } },
    orderBy: [{ day: "asc" }, { startMinute: "asc" }],
  });

export const findShiftById = (id: string): Promise<Shift | null> =>
  prisma.shift.findUnique({ where: { id } });

export const createShift = (restaurantId: string, data: ShiftWriteData): Promise<Shift> =>
  prisma.shift.create({ data: { restaurantId, ...data } });

export const updateShift = (id: string, data: Omit<ShiftWriteData, "staffId" | "day">): Promise<Shift> =>
  prisma.shift.update({ where: { id }, data });

export const deleteShift = (id: string): Promise<Shift> => prisma.shift.delete({ where: { id } });

/** Clears a window before copying a week into it, so nothing is duplicated. */
export const deleteShiftsBetween = (restaurantId: string, from: string, to: string) =>
  prisma.shift.deleteMany({ where: { restaurantId, day: { gte: from, lte: to } } });

export const createShifts = (restaurantId: string, rows: readonly ShiftWriteData[]) =>
  prisma.shift.createMany({ data: rows.map((row) => ({ restaurantId, ...row })) });

/**
 * Replacing a week is all-or-nothing: a copy that deleted the old rota and
 * then failed to write the new one would leave the team with no schedule.
 */
export const replaceWeek = async (
  restaurantId: string,
  from: string,
  to: string,
  rows: readonly ShiftWriteData[],
): Promise<number> => {
  const [, created] = await prisma.$transaction([
    prisma.shift.deleteMany({ where: { restaurantId, day: { gte: from, lte: to } } }),
    prisma.shift.createMany({ data: rows.map((row) => ({ restaurantId, ...row })) }),
  ]);
  return created.count;
};
