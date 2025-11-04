import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col space-y-2 pb-8 border-b border-border/50", className)}>
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1.5 min-w-0 flex-1">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground text-lg">
              {description}
            </p>
          )}
        </div>
        {(actions || children) && (
          <div className="flex items-center space-x-3 flex-shrink-0">
            {actions}
            {children}
          </div>
        )}
      </div>
    </header>
  )
}