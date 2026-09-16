import Link from "next/link";
import {
  BookOpenIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  CookingPotIcon,
  ReceiptTextIcon,
  Trash2Icon,
  WineIcon,
  type LucideIcon,
} from "lucide-react";

import { staffTabs, type StaffScreen, type StaffTrade } from "@/lib/staff-screens";
import { cn } from "@/lib/utils";

export const SCREEN_ICONS: Readonly<Record<StaffScreen, LucideIcon>> = {
  COMMANDES: ReceiptTextIcon,
  PLANNING: CalendarDaysIcon,
  STOCK: ClipboardListIcon,
  PERTES: Trash2Icon,
  CASSE: WineIcon,
  BASES: CookingPotIcon,
  FICHES: BookOpenIcon,
};

/**
 * The thumb bar at the bottom of the staff app: one big target per screen the
 * person is allowed to open. Used standing up, one-handed, in a hurry.
 */
export function StaffTabBar({
  username,
  role,
  screens,
  current,
}: {
  readonly username: string;
  readonly role: StaffTrade;
  readonly screens: readonly string[];
  readonly current: StaffScreen;
}) {
  const tabs = staffTabs({ role, screens }, username);
  if (tabs.length <= 1) return null;

  return (
    <nav
      aria-label="Écrans"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
    >
      {/* Past five tabs the targets would get too narrow to hit with a thumb,
          so the bar scrolls sideways instead of squeezing. */}
      <ul
        className={cn(
          "mx-auto flex max-w-2xl items-stretch gap-1",
          tabs.length > 5 ? "snap-x overflow-x-auto [&>li]:min-w-20" : "justify-around",
        )}
      >
        {tabs.map((tab) => {
          const Icon = SCREEN_ICONS[tab.id];
          const active = tab.id === current;
          return (
            <li key={tab.id} className="min-w-0 flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-xs font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-6" aria-hidden />
                <span className="truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
