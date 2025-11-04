'use client'

import { ReactNode } from 'react'
import { BarChart3, Users, Clock } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface TabConfig {
  value: string
  label: string
  icon: ReactNode
  description: string
  children: ReactNode
}

interface TabsLayoutProps {
  defaultTab?: string
  tabs: TabConfig[]
}

export function TabsLayout({ defaultTab = 'jobs-by-status', tabs }: TabsLayoutProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-gray-600 mt-2">
          Generate and export reports for jobs, technicians, and reminders
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-gray-100 rounded-lg">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-2 py-3 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="space-y-6">
            <Card className="rounded-lg border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  {tab.icon}
                  {tab.label}
                </CardTitle>
                <CardDescription className="text-base">
                  {tab.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {tab.children}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

// Default tab configurations with icons
export const getDefaultTabs = (
  jobsByStatusContent: ReactNode,
  jobsByTechnicianContent: ReactNode,
  upcomingRemindersContent: ReactNode
): TabConfig[] => [
  {
    value: 'jobs-by-status',
    label: 'Jobs by Status',
    icon: <BarChart3 className="w-4 h-4" />,
    description: 'View job completion rates and status breakdown over time',
    children: jobsByStatusContent
  },
  {
    value: 'jobs-by-technician',
    label: 'Jobs by Technician',
    icon: <Users className="w-4 h-4" />,
    description: 'Analyze technician performance and workload distribution',
    children: jobsByTechnicianContent
  },
  {
    value: 'upcoming-reminders',
    label: 'Upcoming Reminders',
    icon: <Clock className="w-4 h-4" />,
    description: 'Track upcoming follow-ups and scheduled reminders',
    children: upcomingRemindersContent
  }
]