import React from "react"
import {
  getIconByRoute,
  getIconNameByRoute,
  ICON_STROKE_WIDTH,
  ICON_SIZES,
  Icons,
  type IconSize,
  type IconKey,
  type IconName
} from "@/config/icons"
import { cn } from "@/lib/utils"

interface AppIconProps {
  /**
   * Icon name from Icons object or route path
   */
  name: IconKey | IconName | string

  /**
   * Icon size - defaults to 20px
   */
  size?: IconSize | number

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Stroke width override - defaults to 1.5
   */
  strokeWidth?: number

  /**
   * Accessibility label
   */
  "aria-label"?: string
}

/**
 * AppIcon - Consistent icon wrapper for the application
 *
 * Usage:
 * <AppIcon name="dashboard" size={20} />
 * <AppIcon name="/customers" size={24} />
 * <AppIcon name="settings" className="text-muted-foreground" />
 */
export function AppIcon({
  name,
  size = 20,
  className,
  strokeWidth = ICON_STROKE_WIDTH,
  "aria-label": ariaLabel,
  ...props
}: AppIconProps) {
  // Determine icon size
  const iconSize = typeof size === "number" ? size : ICON_SIZES[size]

  // Get icon component
  let IconComponent

  if (name in Icons) {
    // Direct icon name lookup
    IconComponent = Icons[name as IconKey]
  } else if (name.startsWith("/")) {
    // Route-based lookup
    IconComponent = getIconByRoute(name)
  } else {
    // Fallback to default icon
    IconComponent = Icons.default
  }

  return (
    <IconComponent
      size={iconSize}
      strokeWidth={strokeWidth}
      className={cn("flex-shrink-0", className)}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
      {...props}
    />
  )
}

/**
 * Pre-sized icon variants for common use cases
 */
export const AppIcon16 = (props: Omit<AppIconProps, "size">) => (
  <AppIcon {...props} size={16} />
)

export const AppIcon18 = (props: Omit<AppIconProps, "size">) => (
  <AppIcon {...props} size={18} />
)

export const AppIcon20 = (props: Omit<AppIconProps, "size">) => (
  <AppIcon {...props} size={20} />
)

export const AppIcon24 = (props: Omit<AppIconProps, "size">) => (
  <AppIcon {...props} size={24} />
)

/**
 * Route-aware icon that automatically selects the correct icon
 * based on the current route or provided route path
 */
interface RouteIconProps extends Omit<AppIconProps, "name"> {
  route: string
}

export function RouteIcon({ route, ...props }: RouteIconProps) {
  const iconName = getIconNameByRoute(route)
  return <AppIcon name={iconName} {...props} />
}