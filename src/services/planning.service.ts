/**
 * The staff rota: who works when, and how many hours that adds up to.
 *
 * The arithmetic all lives in `lib/planning.ts`, which knows nothing about the
 * database — so the totals the screen shows are the totals the tests check.
 * This file is the orchestration: load a window, check ownership, write.
 */

import type { Shift } from "@/generated/prisma/client";
import {
  addDays,
  isWorkedKind,
  mondayOf,
  monthDays,
  monthGrid,
  monthOf,
  overtimeMinutes,
  shiftMinutes,
  totalsByStaff,
  totalsFor,
  weekDays,
  weekWarnings,
  type ShiftKind,
  type StaffShift,
} from "@/lib/planning";
import type {
  ClearWeekInput,
  CopyWeekInput,
  DeleteShiftInput,
  SaveShiftInput,
} from "@/lib/validators/planning";
import {
  createShift,
  deleteShift,
  deleteShiftsBetween,
  findShiftById,
  findShiftsBetween,
  findStaffShiftsBetween,
  replaceWeek,
  updateShift,
  type ShiftWriteData,
} from "@/repositories/shift.repository";
import { findStaffById, findStaffByRestaurant } from "@/repositories/staff.repository";
import type {
  CalendarDay,
  MonthCalendar,
  MonthHours,
  RotaPerson,
  RotaRow,
  ShiftDTO,
  WeekRota,
} from "@/types/planning";
import type { StaffRole } from "@/types/staff";

export const SHIFT_NOT_FOUND = "SHIFT_NOT_FOUND";
export const SHIFT_FORBIDDEN = "SHIFT_FORBIDDEN";
export const STAFF_NOT_IN_RESTAURANT = "STAFF_NOT_IN_RESTAURANT";

export interface PlanningContext {
  readonly restaurantId: string;
  readonly userId: string;
}

const mapShift = (shift: Shift): ShiftDTO => ({
  id: shift.id,
  staffId: shift.staffId,
  day: shift.day,
  kind: shift.kind as ShiftKind,
  startMinute: shift.startMinute,
  endMinute: shift.endMinute,
  breakMinutes: shift.breakMinutes,
  note: shift.note,
});

const asStaffShift = (shift: ShiftDTO): StaffShift => ({
  staffId: shift.staffId,
  day: shift.day,
  kind: shift.kind,
  startMinute: shift.startMinute,
  endMinute: shift.endMinute,
  breakMinutes: shift.breakMinutes,
});

/**
 * Who appears on the rota: everyone still employed. Someone on leave keeps
 * their row — that is exactly when a manager needs to see them.
 */
const rotaPeople = async (restaurantId: string): Promise<RotaPerson[]> =>
  (await findStaffByRestaurant(restaurantId))
    .filter((staff) => staff.status !== "INACTIVE")
    .map((staff) => ({
      id: staff.id,
      name: staff.name,
      role: staff.role as StaffRole,
      employeeCode: staff.employeeCode,
      photoUrl: staff.photoUrl,
      weeklyHours: staff.weeklyHours,
      onLeave: staff.status === "ON_LEAVE",
    }));

// ------------------------------------------------------------------ week ---

export const getWeek = async (ctx: PlanningContext, anyDayOfWeek: string): Promise<WeekRota> => {
  const monday = mondayOf(anyDayOfWeek);
  const days = weekDays(monday);
  const previousMonday = addDays(monday, -7);

  const [people, shifts, previous] = await Promise.all([
    rotaPeople(ctx.restaurantId),
    findShiftsBetween(ctx.restaurantId, monday, days[6]),
    findShiftsBetween(ctx.restaurantId, previousMonday, addDays(previousMonday, 6)),
  ]);

  const mapped = shifts.map(mapShift);
  const totals = totalsByStaff(mapped.map(asStaffShift));

  const rows: RotaRow[] = people.map((person) => {
    const own = mapped.filter((shift) => shift.staffId === person.id);
    const totalsForPerson = totalsFor(totals, person.id);
    return {
      person,
      days: days.map((day) => own.filter((shift) => shift.day === day)),
      workedMinutes: totalsForPerson.workedMinutes,
      workedDays: totalsForPerson.workedDays,
      restDays: totalsForPerson.restDays,
      leaveDays: totalsForPerson.leaveDays,
      overtimeMinutes: overtimeMinutes(totalsForPerson.workedMinutes, person.weeklyHours),
    };
  });

  return {
    monday,
    days,
    rows,
    totalMinutes: rows.reduce((sum, row) => sum + row.workedMinutes, 0),
    warnings: weekWarnings(people, totals).map((warning) => warning.message),
    previousWeekHasShifts: previous.length > 0,
  };
};

// ----------------------------------------------------------------- write ---

const toWriteData = (input: SaveShiftInput): ShiftWriteData => {
  const worked = isWorkedKind(input.kind);
  return {
    staffId: input.staffId,
    day: input.day,
    kind: input.kind,
    // A day off has no hours, whatever was left in the form.
    startMinute: worked ? (input.startMinute ?? null) : null,
    endMinute: worked ? (input.endMinute ?? null) : null,
    breakMinutes: worked ? input.breakMinutes : 0,
    note: input.note ?? null,
  };
};

const ownedShift = async (restaurantId: string, id: string): Promise<Shift> => {
  const shift = await findShiftById(id);
  if (!shift) throw new Error(SHIFT_NOT_FOUND);
  if (shift.restaurantId !== restaurantId) throw new Error(SHIFT_FORBIDDEN);
  return shift;
};

export const saveShift = async (ctx: PlanningContext, input: SaveShiftInput): Promise<ShiftDTO> => {
  const staff = await findStaffById(input.staffId);
  if (!staff || staff.deletedAt || staff.restaurantId !== ctx.restaurantId) {
    throw new Error(STAFF_NOT_IN_RESTAURANT);
  }

  const data = toWriteData(input);
  if (input.id) {
    await ownedShift(ctx.restaurantId, input.id);
    const { staffId: _staffId, day: _day, ...rest } = data;
    return mapShift(await updateShift(input.id, rest));
  }
  return mapShift(await createShift(ctx.restaurantId, data));
};

export const removeShift = async (ctx: PlanningContext, input: DeleteShiftInput): Promise<{ id: string }> => {
  await ownedShift(ctx.restaurantId, input.id);
  await deleteShift(input.id);
  return { id: input.id };
};

/**
 * Most weeks look like the last one. Copying is the difference between a rota
 * written in two minutes and one written in half an hour — so it is a button,
 * and it replaces the target week whole rather than piling shifts on top.
 */
export const copyWeek = async (ctx: PlanningContext, input: CopyWeekInput): Promise<{ copied: number }> => {
  const from = mondayOf(input.fromMonday);
  const to = mondayOf(input.toMonday);
  const shifts = await findShiftsBetween(ctx.restaurantId, from, addDays(from, 6));

  const offsetDays = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  const rows: ShiftWriteData[] = shifts.map((shift) => ({
    staffId: shift.staffId,
    day: addDays(shift.day, offsetDays),
    kind: shift.kind as ShiftKind,
    startMinute: shift.startMinute,
    endMinute: shift.endMinute,
    breakMinutes: shift.breakMinutes,
    note: shift.note,
  }));

  const copied = await replaceWeek(ctx.restaurantId, to, addDays(to, 6), rows);
  return { copied };
};

export const clearWeek = async (ctx: PlanningContext, input: ClearWeekInput): Promise<{ removed: number }> => {
  const monday = mondayOf(input.monday);
  const { count } = await deleteShiftsBetween(ctx.restaurantId, monday, addDays(monday, 6));
  return { removed: count };
};

// ------------------------------------------------------------- calendrier ---

export const getMonth = async (ctx: PlanningContext, month: string): Promise<MonthCalendar> => {
  const grid = monthGrid(month);
  const [people, shifts] = await Promise.all([
    rotaPeople(ctx.restaurantId),
    findShiftsBetween(ctx.restaurantId, grid[0], grid[grid.length - 1]),
  ]);
  const byId = new Map(people.map((person) => [person.id, person]));

  const cells: CalendarDay[] = grid.map((day) => {
    const own = shifts
      .filter((shift) => shift.day === day)
      .map(mapShift)
      .map((shift) => ({
        ...shift,
        name: byId.get(shift.staffId)?.name ?? "—",
        role: byId.get(shift.staffId)?.role ?? ("WAITER" as StaffRole),
      }));
    return {
      day,
      inMonth: monthOf(day) === month,
      shifts: own,
      workedMinutes: own.reduce((sum, shift) => sum + shiftMinutes(shift), 0),
      people: new Set(own.filter((shift) => shiftMinutes(shift) > 0).map((shift) => shift.staffId)).size,
    };
  });

  const weeks: CalendarDay[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));

  return {
    month,
    weeks,
    workedMinutes: cells.filter((cell) => cell.inMonth).reduce((sum, cell) => sum + cell.workedMinutes, 0),
  };
};

// ----------------------------------------------------------------- heures ---

/**
 * The month's hours, person by person. Overtime is counted **week by week**,
 * because that is how French overtime works: 45 hours one week and 25 the next
 * is ten hours of overtime, not a quiet average of 35.
 */
export const getMonthHours = async (ctx: PlanningContext, month: string): Promise<MonthHours> => {
  const days = monthDays(month);
  const [people, shifts] = await Promise.all([
    rotaPeople(ctx.restaurantId),
    findShiftsBetween(ctx.restaurantId, days[0], days[days.length - 1]),
  ]);

  const mapped = shifts.map(mapShift).map(asStaffShift);
  const totals = totalsByStaff(mapped);

  const weekStarts = [...new Set(days.map(mondayOf))];
  const rows = people.map((person) => {
    const own = totalsFor(totals, person.id);
    const overtime = weekStarts.reduce((sum, monday) => {
      const inWeek = mapped.filter(
        (shift) => shift.staffId === person.id && shift.day >= monday && shift.day <= addDays(monday, 6),
      );
      const worked = totalsFor(totalsByStaff(inWeek), person.id).workedMinutes;
      return sum + overtimeMinutes(worked, person.weeklyHours);
    }, 0);
    return {
      person,
      workedMinutes: own.workedMinutes,
      workedDays: own.workedDays,
      restDays: own.restDays,
      leaveDays: own.leaveDays,
      overtimeMinutes: overtime,
    };
  });

  return {
    month,
    rows,
    workedMinutes: rows.reduce((sum, row) => sum + row.workedMinutes, 0),
  };
};

// -------------------------------------------------------- côté personnel ---

export interface MyWeek {
  readonly monday: string;
  readonly days: readonly string[];
  readonly shifts: readonly (readonly ShiftDTO[])[];
  readonly workedMinutes: number;
  readonly weeklyHours: number | null;
}

/** What one person sees of their own week — never anybody else's. */
export const getMyWeek = async (staffId: string, anyDayOfWeek: string): Promise<MyWeek> => {
  const monday = mondayOf(anyDayOfWeek);
  const days = weekDays(monday);
  const [staff, shifts] = await Promise.all([
    findStaffById(staffId),
    findStaffShiftsBetween(staffId, monday, days[6]),
  ]);
  const mapped = shifts.map(mapShift);
  return {
    monday,
    days,
    shifts: days.map((day) => mapped.filter((shift) => shift.day === day)),
    workedMinutes: mapped.reduce((sum, shift) => sum + shiftMinutes(shift), 0),
    weeklyHours: staff?.weeklyHours ?? null,
  };
};
