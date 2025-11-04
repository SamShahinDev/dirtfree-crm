import { getIconByRoute, type IconName } from "./icons"
import type { LucideIcon } from "lucide-react"
import type { AppRole } from "@/lib/auth/roles"

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  iconName: IconName | "default"
  requiredRoles?: AppRole[]
}

export const MAIN_NAV: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: getIconByRoute("/dashboard"),
    iconName: "/dashboard",
    // All roles can access dashboard
  },
  {
    title: "Customers",
    href: "/customers",
    icon: getIconByRoute("/customers"),
    iconName: "/customers",
    // All roles can view customers
  },
  {
    title: "Jobs",
    href: "/jobs",
    icon: getIconByRoute("/jobs"),
    iconName: "/jobs",
    // All roles can access jobs
  },
  {
    title: "Invoices",
    href: "/invoices",
    icon: getIconByRoute("/invoices"),
    iconName: "/invoices",
    requiredRoles: ["admin", "dispatcher"],
  },
  {
    title: "Calendar",
    href: "/schedule/calendar",
    icon: getIconByRoute("/schedule/calendar"),
    iconName: "/schedule/calendar",
    // All roles need scheduling
  },
  {
    title: "Zone board",
    href: "/schedule/zone-board",
    icon: getIconByRoute("/schedule/zone-board"),
    iconName: "/schedule/zone-board",
    // All roles need zone visibility
  },
  {
    title: "Reminders",
    href: "/reminders",
    icon: getIconByRoute("/reminders"),
    iconName: "/reminders",
    // All roles need reminders
  },
  {
    title: "Trucks",
    href: "/trucks",
    icon: getIconByRoute("/trucks"),
    iconName: "/trucks",
    requiredRoles: ["admin", "dispatcher"],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: getIconByRoute("/reports"),
    iconName: "/reports",
    requiredRoles: ["admin", "dispatcher"],
  },
  {
    title: "AI Chatbot",
    href: "/dashboard/chatbot",
    icon: getIconByRoute("/dashboard/chatbot"),
    iconName: "/dashboard/chatbot",
    requiredRoles: ["admin", "dispatcher"],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: getIconByRoute("/settings"),
    iconName: "/settings",
    requiredRoles: ["admin"],
  },
  {
    title: "Users",
    href: "/users",
    icon: getIconByRoute("/users"),
    iconName: "/users",
    requiredRoles: ["admin"],
  },
  {
    title: "Help",
    href: "/help",
    icon: getIconByRoute("/help"),
    iconName: "/help",
    // All roles need help
  },
]

export function getTitleFromPath(pathname: string): string {
  // Handle dynamic routes like /trucks/[id]
  if (pathname.startsWith("/trucks/") && pathname !== "/trucks") {
    const truckId = pathname.split("/")[2]
    return `Truck ${truckId}`
  }

  // Find exact match first
  const exactMatch = MAIN_NAV.find((item) => item.href === pathname)
  if (exactMatch) {
    return exactMatch.title
  }

  // Handle nested routes by finding the closest parent
  const parentMatch = MAIN_NAV.find((item) =>
    pathname.startsWith(item.href) && item.href !== "/"
  )
  if (parentMatch) {
    return parentMatch.title
  }

  // Fallback: convert pathname to title with sentence case
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return "Dashboard"

  return segments[segments.length - 1]
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}