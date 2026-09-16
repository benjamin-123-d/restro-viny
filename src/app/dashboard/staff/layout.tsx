import { TabBar } from "@/components/purchasing/purchasing-ui";

/**
 * Managing people is four questions, in this order: who is in the team, who
 * works when, what the month looks like, and how many hours that makes.
 */
const TABS = [
  { href: "/dashboard/staff", label: "Équipe" },
  { href: "/dashboard/staff/planning", label: "Planning" },
  { href: "/dashboard/staff/calendrier", label: "Calendrier" },
  { href: "/dashboard/staff/heures", label: "Heures" },
] as const;

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <TabBar tabs={TABS} />
      {children}
    </div>
  );
}
