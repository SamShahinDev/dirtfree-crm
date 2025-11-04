import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  MapPin,
  Bell,
  Truck,
  BarChart3,
  Settings,
  UserCog,
  Circle,
  HelpCircle,
  FileText,
  Bot,
  type LucideIcon,
} from "lucide-react"

// Consistent stroke width for all icons
export const ICON_STROKE_WIDTH = 1.5

// Icon size utilities
export const ICON_SIZES = {
  16: 16,
  18: 18,
  20: 20,
  24: 24,
} as const

export type IconSize = keyof typeof ICON_SIZES
export type IconName = keyof typeof ICON_MAP

// Route to icon mapping for all application routes
export const ICON_MAP = {
  "/dashboard": LayoutDashboard,
  "/customers": Users,
  "/jobs": Briefcase,
  "/invoices": FileText,
  "/schedule/calendar": Calendar,
  "/schedule/zone-board": MapPin,
  "/reminders": Bell,
  "/trucks": Truck,
  "/trucks/[id]": Truck, // Dynamic route uses same truck icon
  "/reports": BarChart3,
  "/dashboard/chatbot": Bot,
  "/settings": Settings,
  "/users": UserCog,
  "/help": HelpCircle,
  // Fallback for unknown routes
  "default": Circle,
} as const

// Utility function to get icon component by route
export function getIconByRoute(route: string): LucideIcon {
  const icon = ICON_MAP[route as keyof typeof ICON_MAP]
  return icon || ICON_MAP.default
}

// Utility function to get icon name from route
export function getIconNameByRoute(route: string): IconName | "default" {
  if (route in ICON_MAP) {
    return route as IconName
  }

  // Handle dynamic routes like /trucks/123
  if (route.startsWith("/trucks/") && route !== "/trucks") {
    return "/trucks/[id]"
  }

  // Handle nested routes by finding closest parent
  for (const [path] of Object.entries(ICON_MAP)) {
    if (path !== "default" && route.startsWith(path)) {
      return path as IconName
    }
  }

  return "default"
}

// Pre-configured icon components with consistent sizing
export const Icons = {
  dashboard: LayoutDashboard,
  customers: Users,
  jobs: Briefcase,
  invoices: FileText,
  calendar: Calendar,
  zoneBoard: MapPin,
  reminders: Bell,
  trucks: Truck,
  reports: BarChart3,
  chatbot: Bot,
  settings: Settings,
  users: UserCog,
  help: HelpCircle,

  // Common UI icons
  default: Circle,
  fallback: Circle,
} as const

export type IconKey = keyof typeof Icons