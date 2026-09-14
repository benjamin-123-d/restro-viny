"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  UtensilsCrossedIcon,
  LayoutDashboardIcon,
  ReceiptTextIcon,
  CalculatorIcon,
  BookOpenIcon,
  ArmchairIcon,
  BoxesIcon,
  TruckIcon,
  HandshakeIcon,
  WarehouseIcon,
  ShieldCheckIcon,
  BookOpenCheckIcon,
  ChartColumnIcon,
  ChartNoAxesCombinedIcon,
  UsersIcon,
  Settings2Icon,
  CircleHelpIcon,
} from "lucide-react"

const navMain = [
  { title: "Tableau de bord", url: "/dashboard", icon: <LayoutDashboardIcon /> },
  { title: "Caisse", url: "/dashboard/pos", icon: <CalculatorIcon /> },
  { title: "Commandes", url: "/dashboard/orders", icon: <ReceiptTextIcon /> },
  { title: "Ventes", url: "/dashboard/sales", icon: <ChartNoAxesCombinedIcon /> },
  { title: "Carte", url: "/dashboard/menu", icon: <BookOpenIcon /> },
  { title: "Tables", url: "/dashboard/tables", icon: <ArmchairIcon /> },
  { title: "Inventaire", url: "/dashboard/inventory", icon: <BoxesIcon /> },
  { title: "Achats", url: "/dashboard/purchasing", icon: <TruckIcon /> },
  { title: "Stock", url: "/dashboard/stock", icon: <WarehouseIcon /> },
  { title: "Comptabilité", url: "/dashboard/accounting", icon: <BookOpenCheckIcon /> },
  { title: "Statistiques", url: "/dashboard/statistics", icon: <ChartColumnIcon /> },
  { title: "Personnel", url: "/dashboard/staff", icon: <UsersIcon /> },
]

// Customer quotations, sales orders and delivery notes stay reachable for
// catering and business clients, out of the way of the everyday till sales.
const navSecondary = [
  { title: "Ventes aux entreprises", url: "/dashboard/selling", icon: <HandshakeIcon /> },
  { title: "Rôles et accès", url: "/dashboard/settings/roles", icon: <ShieldCheckIcon /> },
  { title: "Réglages", url: "/dashboard/settings", icon: <Settings2Icon /> },
  { title: "Aide", url: "#", icon: <CircleHelpIcon /> },
]
export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; contact: string }
}) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="/dashboard" />}
            >
              <UtensilsCrossedIcon className="size-5!" />
              <span className="text-base font-semibold">ElitaleRestro</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
