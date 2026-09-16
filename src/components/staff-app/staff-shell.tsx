import type { StaffScreen, StaffTrade } from "@/lib/staff-screens";

import { StaffTabBar } from "./staff-tab-bar";

/**
 * The frame of every staff screen: a title anyone can read at arm's length,
 * and a tab bar thumbed from the bottom of the phone — big targets, because
 * this is used standing up, with one hand, in a hurry.
 */
export function StaffShell({
  username,
  staffName,
  role,
  screens,
  current,
  title,
  subtitle,
  children,
}: {
  readonly username: string;
  readonly staffName: string;
  readonly role: StaffTrade;
  readonly screens: readonly string[];
  readonly current: StaffScreen;
  readonly title: string;
  readonly subtitle?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background pb-28">
      <header className="sticky top-0 z-20 border-b bg-card/95 px-4 py-3 backdrop-blur">
        <p className="text-xs font-medium text-muted-foreground">
          {staffName} · {role === "KITCHEN" ? "Cuisine" : "Salle"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>

      <StaffTabBar username={username} role={role} screens={screens} current={current} />
    </div>
  );
}
