'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Users,
  DollarSign,
  Wrench,
  TrendingUp,
  Map,
  Clock,
  Activity,
  Target,
  Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/analytics', label: 'Overview', icon: BarChart3, exact: true },
  { href: '/analytics/revenue', label: 'Revenue', icon: DollarSign },
  { href: '/analytics/customers', label: 'Customers', icon: Users },
  { href: '/analytics/services', label: 'Services', icon: Wrench },
  { href: '/analytics/technicians', label: 'Technicians', icon: Clock },
  { href: '/analytics/zones', label: 'Zones', icon: Map },
  { href: '/analytics/trends', label: 'Trends', icon: TrendingUp },
  { href: '/analytics/performance', label: 'Performance', icon: Activity },
  { href: '/analytics/goals', label: 'Goals', icon: Target },
  { href: '/analytics/schedule', label: 'Schedule', icon: Calendar },
]

export function AnalyticsNav() {
  const pathname = usePathname()

  return (
    <div className="w-64 bg-white border-r h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">Analytics & Reports</h2>
        <p className="text-sm text-gray-500 mt-1">Business insights</p>
      </div>
      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group',
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'hover:bg-gray-50 text-gray-700'
                )}
              >
                <Icon className={cn(
                  'w-5 h-5 transition-colors',
                  isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                )} />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1 h-4 bg-blue-600 rounded-full" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Quick Stats */}
      <div className="p-4 border-t bg-gray-50">
        <div className="text-xs text-gray-500 mb-2">Quick Stats</div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Today's Revenue</span>
            <span className="font-semibold">$2,450</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Jobs Completed</span>
            <span className="font-semibold">12/18</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Efficiency</span>
            <span className="font-semibold text-green-600">94%</span>
          </div>
        </div>
      </div>
    </div>
  )
}