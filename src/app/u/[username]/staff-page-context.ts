import { redirect } from "next/navigation";

import { getStaffContextOrNull } from "@/lib/staff-auth";
import { canUseScreen, type StaffScreen } from "@/lib/staff-screens";
import { findStaffById } from "@/repositories/staff.repository";
import { getStaffLoginRestaurant } from "@/services/staff-auth.service";

/**
 * Everything a staff screen needs before it renders: who is signed in, that
 * the address belongs to their restaurant, and that this screen is one they
 * are allowed to open — the same check the actions make.
 */
export const requireStaffScreen = async (username: string, screen: StaffScreen) => {
  const ctx = await getStaffContextOrNull();
  if (!ctx) redirect(`/u/${username}/login`);

  const [restaurant, staff] = await Promise.all([getStaffLoginRestaurant(username), findStaffById(ctx.staffId)]);
  if (!restaurant || restaurant.id !== ctx.restaurantId || !staff) redirect(`/u/${username}/login`);
  if (!canUseScreen({ role: staff.role, screens: staff.screens }, screen)) redirect(`/u/${username}`);

  return { ctx, restaurant, screens: staff.screens, role: staff.role };
};
