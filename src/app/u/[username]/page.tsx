import { redirect } from "next/navigation";

import { KitchenDisplay } from "@/components/kitchen/kitchen-display";
import { StaffTabBar } from "@/components/staff-app/staff-tab-bar";
import { WaiterHome } from "@/components/waiter/waiter-home";
import { getStaffContextOrNull } from "@/lib/staff-auth";
import { findStaffById } from "@/repositories/staff.repository";
import { listKitchenTickets } from "@/services/kitchen.service";
import { listOrders } from "@/services/order.service";
import { getStaffLoginRestaurant } from "@/services/staff-auth.service";

export default async function StaffHomePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const ctx = await getStaffContextOrNull();
  if (!ctx) {
    redirect(`/u/${username}/login`);
  }

  // The URL's restaurant must match the signed-in staff's restaurant.
  const [restaurant, staff] = await Promise.all([getStaffLoginRestaurant(username), findStaffById(ctx.staffId)]);
  if (!restaurant || restaurant.id !== ctx.restaurantId || !staff) {
    redirect(`/u/${username}/login`);
  }

  // The service screen keeps its own full-height layout; the tab bar floats
  // over it, so the kitchen and the room reach their other screens with a thumb.
  const tabBar = (
    <StaffTabBar username={restaurant.username} role={staff.role} screens={staff.screens} current="COMMANDES" />
  );

  if (ctx.role === "WAITER") {
    const openOrders = await listOrders(ctx.restaurantId, ["OPEN"]);
    return (
      <main className="min-h-svh pb-28">
        <WaiterHome
          username={restaurant.username}
          restaurantName={restaurant.name}
          staffName={ctx.name}
          openOrders={openOrders}
        />
        {tabBar}
      </main>
    );
  }

  return (
    <main className="min-h-svh pb-28">
      <KitchenDisplay
        username={restaurant.username}
        restaurantName={restaurant.name}
        staffName={ctx.name}
        tickets={await listKitchenTickets(ctx.restaurantId)}
      />
      {tabBar}
    </main>
  );
}
