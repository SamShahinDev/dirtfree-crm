export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { Plus } from 'lucide-react'

import PageShell from "@/components/shell/PageShell"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from '@/components/ui/button'
import { requireAuth } from '@/lib/auth/guards'
import { getUserRole } from '@/lib/auth/roles'
import { listTrucks } from './actions'
import { TrucksGrid } from './_components/TrucksGrid'
import { TrucksSkeleton } from './_components/TrucksSkeleton'

async function TrucksContent() {
  const result = await listTrucks({})

  if (!result.success) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700">Failed to load trucks. Please try again.</p>
      </div>
    )
  }

  const trucks = result.data

  if (trucks.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
        <div className="mx-auto mb-4 w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No trucks found</h3>
        <p className="text-gray-600">Add your first truck to get started.</p>
      </div>
    )
  }

  return <TrucksGrid trucks={trucks} />
}

export default async function TrucksPage() {
  const user = await requireAuth()
  const role = await getUserRole(user.id)
  const canManage = role === 'admin' || role === 'dispatcher'

  return (
    <PageShell>
      <div className="space-y-6">
        <PageHeader
          title="Trucks"
          description="Manage fleet vehicles, tools, and maintenance schedules"
          actions={
            canManage ? (
              <Button
                disabled
                className="bg-blue-600 hover:bg-blue-700"
                aria-label="Add new truck (coming soon)"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Truck
              </Button>
            ) : null
          }
        />

        <Suspense fallback={<TrucksSkeleton />}>
          <TrucksContent />
        </Suspense>
      </div>
    </PageShell>
  )
}