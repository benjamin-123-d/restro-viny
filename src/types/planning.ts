import type { ShiftKind } from "@/lib/planning";
import type { StaffRole } from "@/types/staff";

export interface ShiftDTO {
  readonly id: string;
  readonly staffId: string;
  /** « YYYY-MM-DD ». */
  readonly day: string;
  readonly kind: ShiftKind;
  readonly startMinute: number | null;
  readonly endMinute: number | null;
  readonly breakMinutes: number;
  readonly note: string | null;
}

/** Just enough of a person to draw a rota row. */
export interface RotaPerson {
  readonly id: string;
  readonly name: string;
  readonly role: StaffRole;
  readonly employeeCode: string;
  readonly photoUrl: string | null;
  readonly weeklyHours: number | null;
  readonly onLeave: boolean;
}

export interface RotaRow {
  readonly person: RotaPerson;
  /** Seven entries, Monday first; several shifts a day means a split service. */
  readonly days: readonly (readonly ShiftDTO[])[];
  readonly workedMinutes: number;
  readonly workedDays: number;
  readonly restDays: number;
  readonly leaveDays: number;
  readonly overtimeMinutes: number;
}

export interface WeekRota {
  readonly monday: string;
  readonly days: readonly string[];
  readonly rows: readonly RotaRow[];
  /** Hours planned for the whole team that week. */
  readonly totalMinutes: number;
  readonly warnings: readonly string[];
  /** Whether the week before holds anything to copy from. */
  readonly previousWeekHasShifts: boolean;
}

export interface CalendarDay {
  readonly day: string;
  readonly inMonth: boolean;
  readonly shifts: readonly (ShiftDTO & { readonly name: string; readonly role: StaffRole })[];
  readonly workedMinutes: number;
  readonly people: number;
}

export interface MonthCalendar {
  readonly month: string;
  readonly weeks: readonly (readonly CalendarDay[])[];
  readonly workedMinutes: number;
}

export interface MonthHoursRow {
  readonly person: RotaPerson;
  readonly workedMinutes: number;
  readonly workedDays: number;
  readonly restDays: number;
  readonly leaveDays: number;
  /** Hours beyond the contract, counted week by week — not on the month total. */
  readonly overtimeMinutes: number;
}

export interface MonthHours {
  readonly month: string;
  readonly rows: readonly MonthHoursRow[];
  readonly workedMinutes: number;
}
