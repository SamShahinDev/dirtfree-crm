"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Menu, Bell, User, Settings, LogOut, Plus, Users, Briefcase, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { getTitleFromPath } from "@/config/navigation"
import { Sidebar } from "./Sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { AppIcon } from "@/components/ui/AppIcon"
import { useUserRole } from "@/lib/hooks/use-user-role"

interface TopbarProps {
  className?: string
}

export function Topbar({ className }: TopbarProps) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pageTitle = getTitleFromPath(pathname)
  const { user, role } = useUserRole()

  const handleUserMenuAction = async (action: string) => {
    console.log(`User menu action: ${action}`)

    if (action === "signout") {
      // Sign out user and redirect to login
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        await supabase.auth.signOut()
        window.location.href = '/login'
      } catch (error) {
        console.error('Sign out error:', error)
        // Fallback - force redirect to login
        window.location.href = '/login'
      }
    } else if (action === "profile") {
      // Navigate to profile page (placeholder)
      console.log("Navigate to profile")
    } else if (action === "settings") {
      // Navigate to settings page (placeholder)
      console.log("Navigate to settings")
    }
  }

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-4 md:px-6">
          {/* Mobile menu button */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden mr-2"
                aria-label="Open navigation menu"
              >
                <Menu size={20} strokeWidth={1.5} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <Sidebar />
            </SheetContent>
          </Sheet>

          {/* Page Title with Typography */}
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-2">
            {/* Quick Create Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  aria-label="Quick create"
                >
                  <Plus className="component-icon" strokeWidth={1.5} />
                  <span className="hidden sm:inline">Create</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Quick Create</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/customers?new=true" className="flex items-center">
                    <Users className="component-icon mr-2" strokeWidth={1.5} />
                    New Customer
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/jobs?new=true" className="flex items-center">
                    <Briefcase className="component-icon mr-2" strokeWidth={1.5} />
                    New Job
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/reminders?new=true" className="flex items-center">
                    <Bell className="component-icon mr-2" strokeWidth={1.5} />
                    New Reminder
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/schedule/calendar" className="flex items-center">
                    <Calendar className="component-icon mr-2" strokeWidth={1.5} />
                    Schedule
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="View notifications"
                  onClick={() => console.log("Notifications clicked")}
                >
                  <div className="relative">
                    <AppIcon name="reminders" size={20} aria-label="Notifications icon" />
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
                    >
                      3
                    </Badge>
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="label-sm">Notifications (3 unread)</p>
              </TooltipContent>
            </Tooltip>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 rounded-full z-50"
                  aria-label="Open user menu"
                >
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                    <AppIcon
                      name="users"
                      size={16}
                      className="text-primary-foreground"
                      aria-label="User avatar"
                    />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 z-[9999] relative" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="label">{user?.display_name || user?.email || 'User'}</p>
                    <p className="p-xs">
                      {user?.email}
                    </p>
                    {role && (
                      <div className="flex items-center mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </Badge>
                      </div>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleUserMenuAction("profile")}>
                  <AppIcon name="users" size={16} className="mr-2" />
                  <span className="label">Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUserMenuAction("settings")}>
                  <AppIcon name="settings" size={16} className="mr-2" />
                  <span className="label">Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleUserMenuAction("signout")}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  <span className="label">Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </TooltipProvider>
  )
}