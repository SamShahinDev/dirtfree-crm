import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { NavigationErrorBoundary } from "@/components/error-boundary"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-shrink-0">
        <NavigationErrorBoundary>
          <Sidebar />
        </NavigationErrorBoundary>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <Topbar />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#f9fafb' }}>
          <div className="relative">
            {/* Add dot pattern overlay */}
            <div className="absolute inset-0 bg-dot-pattern opacity-[0.015]" />
            {/* Remove the max-w-7xl constraint from here - let pages handle it */}
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}