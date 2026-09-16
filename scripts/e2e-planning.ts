import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { addDays, hoursText, mondayOf } from "../src/lib/planning";
import {
  clearWeek,
  copyWeek,
  getMonthHours,
  getMyWeek,
  getWeek,
  saveShift,
} from "../src/services/planning.service";

/**
 * Walks the rota the whole way on the real database: a week with a split
 * service and a night that runs past midnight, the totals it produces, the
 * copy onto the following week, and what the person themselves sees.
 *
 *   npx tsx scripts/e2e-planning.ts
 *   npx tsx scripts/e2e-planning.ts --purge
 */

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });

// A week far enough ahead that it cannot collide with a real rota.
const MONDAY = mondayOf("2027-03-01");
const NEXT = addDays(MONDAY, 7);

const purge = async () => {
  const { count } = await prisma.shift.deleteMany({
    where: { day: { gte: MONDAY, lte: addDays(NEXT, 6) } },
  });
  console.log(`Supprimé : ${count} service(s) de test.`);
};

const run = async () => {
  const restaurant = await prisma.restaurant.findFirst({ where: { deletedAt: null }, select: { id: true, ownerId: true } });
  if (!restaurant) throw new Error("Aucun restaurant.");
  const ctx = { restaurantId: restaurant.id, userId: restaurant.ownerId };

  const staff = await prisma.staff.findFirst({
    where: { restaurantId: restaurant.id, deletedAt: null, status: { not: "INACTIVE" } },
    select: { id: true, name: true, weeklyHours: true },
  });
  if (!staff) throw new Error("Aucun membre du personnel. Ajoutez quelqu'un dans Personnel → Équipe.");
  console.log(`Personne suivie : ${staff.name}`);

  await purge();

  // Lundi : coupure midi (11:00–15:00) puis soir (18:30–01:00, donc après minuit).
  await saveShift(ctx, { staffId: staff.id, day: MONDAY, kind: "TRAVAIL", startMinute: 660, endMinute: 900, breakMinutes: 0 });
  await saveShift(ctx, { staffId: staff.id, day: MONDAY, kind: "TRAVAIL", startMinute: 1110, endMinute: 60, breakMinutes: 30 });
  // Mardi : repos.
  await saveShift(ctx, { staffId: staff.id, day: addDays(MONDAY, 1), kind: "REPOS", breakMinutes: 0 });
  // Mercredi : congé.
  await saveShift(ctx, { staffId: staff.id, day: addDays(MONDAY, 2), kind: "CONGE", breakMinutes: 0 });

  const week = await getWeek(ctx, MONDAY);
  const row = week.rows.find((r) => r.person.id === staff.id);
  if (!row) throw new Error("La personne n'apparaît pas sur le planning.");

  const expected = 240 + (390 - 30); // midi + soir moins la pause
  const copied = await copyWeek(ctx, { fromMonday: MONDAY, toMonday: NEXT });
  const nextWeek = await getWeek(ctx, NEXT);
  const nextRow = nextWeek.rows.find((r) => r.person.id === staff.id);
  const mine = await getMyWeek(staff.id, MONDAY);
  const month = await getMonthHours(ctx, MONDAY.slice(0, 7));
  const monthRow = month.rows.find((r) => r.person.id === staff.id);

  const checks: [string, boolean, string][] = [
    ["La semaine commence un lundi", week.monday === MONDAY, week.monday],
    ["La coupure du lundi fait deux services", row.days[0].length === 2, `${row.days[0].length}`],
    ["Le service de nuit est compté", row.workedMinutes === expected, hoursText(row.workedMinutes)],
    ["Un seul jour travaillé", row.workedDays === 1, `${row.workedDays}`],
    ["Le repos est compté", row.restDays === 1, `${row.restDays}`],
    ["Le congé est compté", row.leaveDays === 1, `${row.leaveDays}`],
    ["La semaine suivante est recopiée", copied.copied === 4, `${copied.copied}`],
    ["Les heures suivent la copie", nextRow?.workedMinutes === expected, hoursText(nextRow?.workedMinutes ?? 0)],
    ["La personne voit sa propre semaine", mine.shifts[0].length === 2, `${mine.shifts[0].length}`],
    ["Le mois additionne les deux semaines", monthRow?.workedMinutes === expected * 2, hoursText(monthRow?.workedMinutes ?? 0)],
  ];

  let failed = 0;
  for (const [label, ok, value] of checks) {
    console.log(`${ok ? "OK  " : "ÉCHEC"} ${label} : ${value}`);
    if (!ok) failed += 1;
  }

  const cleared = await clearWeek(ctx, { monday: MONDAY });
  const clearedNext = await clearWeek(ctx, { monday: NEXT });
  console.log(`\nNettoyage : ${cleared.removed + clearedNext.removed} service(s) de test retirés.`);
  console.log(failed === 0 ? "Tout est conforme." : `${failed} vérification(s) en échec.`);
  if (failed > 0) process.exitCode = 1;
};

const main = async () => {
  if (process.argv.includes("--purge")) await purge();
  else await run();
  await prisma.$disconnect();
};

main().catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
