'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { ReportBuilder } from '@/components/analytics/reports/report-builder'
import { SavedReports } from '@/components/analytics/reports/saved-reports'
import { ScheduledReports } from '@/components/analytics/reports/scheduled-reports'

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'builder' | 'saved' | 'scheduled'>('builder')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Reports</h1>

      <div className="flex gap-4 mb-6">
        {[
          { key: 'builder', label: 'Report Builder' },
          { key: 'saved', label: 'Saved Reports' },
          { key: 'scheduled', label: 'Scheduled Reports' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'builder' && <ReportBuilder />}
      {activeTab === 'saved' && <SavedReports />}
      {activeTab === 'scheduled' && <ScheduledReports />}
    </div>
  )
}