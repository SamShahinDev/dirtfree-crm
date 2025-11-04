"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { MAIN_NAV } from "@/config/navigation"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AppIcon } from "@/components/ui/AppIcon"
import { useUserRole, canAccess } from "@/lib/hooks/use-user-role"
import { LogoutButton } from "@/components/auth/logout-button"

interface SidebarProps {
  className?: string
}

// Navigation sections for better organization
const NAVIGATION_SECTIONS = [
  {
    label: "Home",
    items: ["/dashboard"]
  },
  {
    label: "Operations",
    items: ["/customers", "/jobs", "/invoices"]
  },
  {
    label: "Scheduling",
    items: ["/schedule/calendar", "/schedule/zone-board"]
  },
  {
    label: "Management",
    items: ["/reminders", "/trucks", "/reports"]
  },
  {
    label: "Support",
    items: ["/dashboard/chatbot"]
  },
  {
    label: "System",
    items: ["/settings", "/users", "/help"]
  }
]

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { role, loading, error } = useUserRole()

  // Prefetch common routes on mount for faster navigation
  useEffect(() => {
    const commonRoutes = [
      '/dashboard',
      '/customers',
      '/jobs',
      '/schedule/calendar',
      '/schedule/zone-board'
    ]

    commonRoutes.forEach(route => {
      router.prefetch(route)
    })
  }, [router])

  // Group navigation items by section and filter by role
  const getItemsBySection = (sectionItems: string[]) => {
    return MAIN_NAV.filter(item => {
      // Check if item is in this section
      if (!sectionItems.includes(item.href)) return false

      // If no required roles, show to everyone
      if (!item.requiredRoles) return true

      // If there's an error or still loading, show all items that don't require roles
      // This ensures navigation still works even if role fetch fails
      if (loading || error) {
        return !item.requiredRoles || item.requiredRoles.length === 0
      }

      // Check if user has access to this item
      return canAccess(role, item.requiredRoles)
    })
  }

  return (
    <div className={cn("flex h-full w-64 flex-col border-r app-canvas", className)}>
      {/* Logo/Brand */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-sm font-bold text-primary-foreground">DF</span>
          </div>
          <span className="font-bold text-lg">Dirt Free CRM</span>
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1" role="navigation" aria-label="Main navigation">
          {NAVIGATION_SECTIONS.map((section, sectionIndex) => {
            const sectionItems = getItemsBySection(section.items)

            if (sectionItems.length === 0) return null

            return (
              <div key={section.label}>
                {sectionIndex > 0 && (
                  <div className="nav-section-label">
                    {section.label}
                  </div>
                )}

                <div className="space-y-1">
                  {sectionItems.map((item) => {
                    const isActive = pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(item.href))

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={true}
                        className={cn(
                          "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                          "hover:bg-accent/30 hover:text-foreground",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isActive
                            ? "bg-accent/30 text-foreground"
                            : "text-muted-foreground"
                        )}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <AppIcon
                          name={item.iconName}
                          className="nav-icon"
                          size={18}
                          aria-label={`${item.title} icon`}
                        />
                        <span>{item.title}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t">
        <div className="p-4">
          <LogoutButton />
        </div>
        <div className="px-4 pb-4 text-xs text-center text-muted-foreground">
          © 2025 Dirt Free CRM
        </div>
      </div>
    </div>
  )
}