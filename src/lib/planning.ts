/**
 * The arithmetic behind the staff rota: weeks, days, hours.
 *
 * Two decisions shape everything here.
 *
 * A day is a plain « YYYY-MM-DD » string, never a `Date`. A rota is read and
 * written in calendar days — « samedi 20 » — and a `Date` carries an instant,
 * which drifts by an hour twice a year and by two when the server sits in
 * another timezone. Strings cannot drift.
 *
 * A time is a number of minutes since midnight. A service that starts at 18:30
 * and ends at 01:00 is 390 minutes, not minus 1 050: when the end is before the
 * start, the shift ran past midnight. Any restaurant rota that ignores that is
 * wrong every Saturday night.
 */

export type ShiftKind = "TRAVAIL" | "REPOS" | "CONGE" | "MALADIE" | "ABSENCE" | "FORMATION";

export interface ShiftKindDefinition {
  readonly id: ShiftKind;
  readonly label: string;
  /** Two or three letters, for a cell too small for the full word. */
  readonly short: string;
  /** Whether the hours count as worked time. */
  readonly worked: boolean;
}

export const SHIFT_KINDS: readonly ShiftKindDefinition[] = [
  { id: "TRAVAIL", label: "Travail", short: "T", worked: true },
  { id: "FORMATION", label: "Formation", short: "F", worked: true },
  { id: "REPOS", label: "Repos", short: "R", worked: false },
  { id: "CONGE", label: "Congé", short: "C", worked: false },
  { id: "MALADIE", label: "Maladie", short: "M", worked: false },
  { id: "ABSENCE", label: "Absence", short: "A", worked: false },
];

const KIND_BY_ID = new Map(SHIFT_KINDS.map((kind) => [kind.id, kind]));

export const shiftKind = (id: string): ShiftKindDefinition | undefined => KIND_BY_ID.get(id as ShiftKind);

export const isShiftKind = (value: string): value is ShiftKind => KIND_BY_ID.has(value as ShiftKind);

/** Hours that count towards the week: work and training, never leave. */
export const isWorkedKind = (kind: ShiftKind): boolean => KIND_BY_ID.get(kind)?.worked === true;

// ------------------------------------------------------------------ days ---

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isDay = (value: string): boolean => DAY_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/**
 * Days are handled through UTC so that adding one never lands on the same day
 * again — which is what happens on the night the clocks go back.
 */
const toUtc = (day: string): Date => new Date(`${day}T00:00:00Z`);

const fromUtc = (date: Date): string => date.toISOString().slice(0, 10);

export const addDays = (day: string, count: number): string => {
  const date = toUtc(day);
  date.setUTCDate(date.getUTCDate() + count);
  return fromUtc(date);
};

/** 1 = Monday … 7 = Sunday, the way a French rota is read. */
export const weekdayOf = (day: string): number => {
  const sunday0 = toUtc(day).getUTCDay();
  return sunday0 === 0 ? 7 : sunday0;
};

/** The Monday of the week that contains this day. */
export const mondayOf = (day: string): string => addDays(day, 1 - weekdayOf(day));

/** The seven days of the week starting at this Monday. */
export const weekDays = (monday: string): string[] =>
  Array.from({ length: 7 }, (_, index) => addDays(monday, index));

export const monthOf = (day: string): string => day.slice(0, 7);

export const firstDayOfMonth = (month: string): string => `${month}-01`;

export const addMonths = (month: string, count: number): string => {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1 + count;
  const shifted = new Date(Date.UTC(year, index, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Every day of a month, in order. */
export const monthDays = (month: string): string[] => {
  const days: string[] = [];
  let day = firstDayOfMonth(month);
  while (monthOf(day) === month) {
    days.push(day);
    day = addDays(day, 1);
  }
  return days;
};

/**
 * The full weeks a month calendar is drawn on: from the Monday before the 1st
 * to the Sunday after the last day, so every row holds seven cells.
 */
export const monthGrid = (month: string): string[] => {
  const days = monthDays(month);
  const start = mondayOf(days[0]);
  const end = addDays(mondayOf(days[days.length - 1]), 6);
  const grid: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) grid.push(day);
  return grid;
};

const DAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const DAY_SHORT = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export const dayName = (day: string): string => DAY_NAMES[weekdayOf(day) - 1];

export const dayShort = (day: string): string => DAY_SHORT[weekdayOf(day) - 1];

/** « lun. 15 » — what fits in the head of a rota column. */
export const dayLabel = (day: string): string => `${dayShort(day)} ${Number(day.slice(8, 10))}`;

/** « lundi 15 septembre » */
export const dayLong = (day: string): string =>
  `${dayName(day)} ${Number(day.slice(8, 10))} ${MONTH_NAMES[Number(day.slice(5, 7)) - 1]}`;

export const monthLabel = (month: string): string =>
  `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** « semaine du 15 au 21 septembre » */
export const weekLabel = (monday: string): string => {
  const sunday = addDays(monday, 6);
  const from = Number(monday.slice(8, 10));
  const to = Number(sunday.slice(8, 10));
  const fromMonth = MONTH_NAMES[Number(monday.slice(5, 7)) - 1];
  const toMonth = MONTH_NAMES[Number(sunday.slice(5, 7)) - 1];
  return fromMonth === toMonth
    ? `semaine du ${from} au ${to} ${toMonth}`
    : `semaine du ${from} ${fromMonth} au ${to} ${toMonth}`;
};

// ----------------------------------------------------------------- times ---

/** « 18:30 » → 1110. Anything else → null. */
export const textToMinutes = (text: string): number | null => {
  const match = /^(\d{1,2})\s*[:h.]\s*(\d{2})?$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

/** 1110 → « 18:30 ». */
export const minutesToText = (minutes: number): string =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** 450 → « 7 h 30 », 480 → « 8 h ». What a payslip conversation needs. */
export const hoursText = (minutes: number): string => {
  const sign = minutes < 0 ? "-" : "";
  const total = Math.abs(Math.round(minutes));
  const rest = total % 60;
  return rest === 0 ? `${sign}${total / 60} h` : `${sign}${Math.floor(total / 60)} h ${String(rest).padStart(2, "0")}`;
};

export interface ShiftLike {
  readonly kind: ShiftKind;
  readonly startMinute: number | null;
  readonly endMinute: number | null;
  readonly breakMinutes: number;
}

const DAY_MINUTES = 24 * 60;

/**
 * How long a shift lasts, break deducted. An end before the start means the
 * service ran past midnight — 18:30 to 01:00 is six hours and a half, not a
 * negative number.
 */
export const shiftMinutes = (shift: ShiftLike): number => {
  if (!isWorkedKind(shift.kind)) return 0;
  if (shift.startMinute == null || shift.endMinute == null) return 0;
  const span = shift.endMinute <= shift.startMinute
    ? shift.endMinute + DAY_MINUTES - shift.startMinute
    : shift.endMinute - shift.startMinute;
  return Math.max(0, span - Math.max(0, shift.breakMinutes));
};

/** « 18:30 – 01:00 » or « Congé » when there are no hours to show. */
export const shiftLabel = (shift: ShiftLike): string => {
  if (shift.startMinute == null || shift.endMinute == null) {
    return shiftKind(shift.kind)?.label ?? shift.kind;
  }
  return `${minutesToText(shift.startMinute)} – ${minutesToText(shift.endMinute)}`;
};

// ---------------------------------------------------------------- totals ---

export interface StaffShift extends ShiftLike {
  readonly staffId: string;
  readonly day: string;
}

export interface StaffTotals {
  readonly workedMinutes: number;
  /** Days with at least one worked shift. */
  readonly workedDays: number;
  readonly restDays: number;
  readonly leaveDays: number;
}

const EMPTY: StaffTotals = { workedMinutes: 0, workedDays: 0, restDays: 0, leaveDays: 0 };

/** What each person adds up to over a set of shifts. */
export const totalsByStaff = (shifts: readonly StaffShift[]): Map<string, StaffTotals> => {
  const workedDays = new Map<string, Set<string>>();
  const totals = new Map<string, { worked: number; rest: number; leave: number }>();

  for (const shift of shifts) {
    const running = totals.get(shift.staffId) ?? { worked: 0, rest: 0, leave: 0 };
    const minutes = shiftMinutes(shift);
    running.worked += minutes;
    if (shift.kind === "REPOS") running.rest += 1;
    if (shift.kind === "CONGE" || shift.kind === "MALADIE" || shift.kind === "ABSENCE") running.leave += 1;
    totals.set(shift.staffId, running);

    if (minutes > 0) {
      const days = workedDays.get(shift.staffId) ?? new Set<string>();
      days.add(shift.day);
      workedDays.set(shift.staffId, days);
    }
  }

  return new Map(
    [...totals].map(([staffId, running]) => [
      staffId,
      {
        workedMinutes: running.worked,
        workedDays: workedDays.get(staffId)?.size ?? 0,
        restDays: running.rest,
        leaveDays: running.leave,
      },
    ]),
  );
};

export const totalsFor = (totals: Map<string, StaffTotals>, staffId: string): StaffTotals =>
  totals.get(staffId) ?? EMPTY;

/**
 * Minutes beyond the contract. In France the working week is 35 hours and
 * anything above is paid at a higher rate, so the figure has to be visible
 * while the rota is being written — not discovered on the payslip.
 */
export const overtimeMinutes = (workedMinutes: number, contractHours: number | null): number =>
  contractHours == null ? 0 : Math.max(0, workedMinutes - contractHours * 60);

/** The legal working week, and the ceiling above which a week is unlawful. */
export const LEGAL_WEEK_HOURS = 35;
export const MAX_WEEK_HOURS = 48;

export interface WeekWarning {
  readonly staffId: string;
  readonly message: string;
}

/**
 * What a manager must be told before publishing the week. These are the two
 * rules a restaurant breaks by accident: too many hours, and no day off.
 */
export const weekWarnings = (
  people: readonly { readonly id: string; readonly name: string; readonly weeklyHours: number | null }[],
  totals: Map<string, StaffTotals>,
): WeekWarning[] => {
  const warnings: WeekWarning[] = [];
  for (const person of people) {
    const { workedMinutes, workedDays, restDays, leaveDays } = totalsFor(totals, person.id);
    if (workedMinutes > MAX_WEEK_HOURS * 60) {
      warnings.push({
        staffId: person.id,
        message: `${person.name} : ${hoursText(workedMinutes)} cette semaine, au-dessus du maximum légal de ${MAX_WEEK_HOURS} h.`,
      });
    }
    if (workedDays >= 6 && restDays === 0 && leaveDays === 0) {
      warnings.push({
        staffId: person.id,
        message: `${person.name} : sept jours travaillés sans repos hebdomadaire.`,
      });
    }
    const contract = person.weeklyHours;
    if (contract != null && workedMinutes > 0 && workedMinutes < contract * 60 - 60) {
      warnings.push({
        staffId: person.id,
        message: `${person.name} : ${hoursText(workedMinutes)} prévues pour un contrat de ${contract} h.`,
      });
    }
  }
  return warnings;
};
