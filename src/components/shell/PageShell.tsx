/**
 * PageShell Component
 * Provides consistent page layout wrapper with modern SaaS spacing and rhythm
 */

import { cn } from "@/lib/utils"

interface PageShellProps {
  children: React.ReactNode
  className?: string
}

export default function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn(
      "mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-6 lg:py-8 relative",
      className
    )}>
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none" />
      <div className="relative">
        {children}
      </div>
    </div>
  )
}