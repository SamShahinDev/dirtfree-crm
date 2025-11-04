import { Suspense } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { FilterProvider } from '@/components/filters/FilterProvider'
import { KPICards } from './_components/KPICards'
import { FiltersBar } from './_components/FiltersBar'
import { ResponsesTable } from './_components/ResponsesTable'
import { NegativesQueue } from './_components/NegativesQueue'
import { SatisfactionSkeleton } from './_components/SatisfactionSkeleton'

export default function SatisfactionReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports — Satisfaction"
        description="Customer satisfaction metrics and feedback management"
      />

      <FilterProvider>
        <div className="space-y-6">
          {/* Filters */}
          <FiltersBar />

          {/* Content with loading states */}
          <Suspense fallback={<SatisfactionSkeleton />}>
            <div className="space-y-6">
              {/* KPI Cards */}
              <KPICards />

              {/* Data Tables Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Latest Responses */}
                <div className="space-y-4">
                  <ResponsesTable />
                </div>

                {/* Unresolved Negatives */}
                <div className="space-y-4">
                  <NegativesQueue />
                </div>
              </div>
            </div>
          </Suspense>
        </div>
      </FilterProvider>
    </div>
  )
}