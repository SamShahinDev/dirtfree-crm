'use client'

import { useState, useEffect } from 'react'
import { Plus, Shield } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { requireAuth } from '@/lib/auth/guards'
import { getUserRole } from '@/lib/auth/roles'
import { checkAccess } from '../board/actions'
import { ThreadList } from '../board/_components/ThreadList'
import { ThreadView } from '../board/_components/ThreadView'
import { NewThreadDialog } from '../board/_components/NewThreadDialog'

interface VehicleBoardProps {
  truckId: string
}

export function VehicleBoard({ truckId }: VehicleBoardProps) {
  console.log('[VehicleBoard] Component initialized with truck ID:', {
    truckId,
    truckIdType: typeof truckId,
    truckIdLength: truckId ? truckId.length : 0,
    isValidUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(truckId || '')
  })

  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [showNewThread, setShowNewThread] = useState(false)
  const [loading, setLoading] = useState(true)

  // Check access on mount
  useEffect(() => {
    const checkTruckAccess = async () => {
      try {
        const result = await checkAccess({ truckId })
        if (result.success) {
          setHasAccess(result.data.hasAccess)
        } else {
          setHasAccess(false)
        }
      } catch (error) {
        console.error('Error checking access:', error)
        setHasAccess(false)
      } finally {
        setLoading(false)
      }
    }

    checkTruckAccess()
  }, [truckId])

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-12 gap-6 h-96">
          <div className="col-span-4 bg-gray-100 rounded animate-pulse" />
          <div className="col-span-8 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  // Access denied state
  if (!hasAccess) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-12 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-red-900 mb-2">Access Denied</h3>
        <p className="text-red-700 max-w-md mx-auto">
          You don't have permission to view this truck's Vehicle Board.
          Contact your administrator to request access.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Vehicle Communication Board</h2>
          <Dialog open={showNewThread} onOpenChange={setShowNewThread}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 relative z-10 cursor-pointer">
                <Plus className="w-4 h-4 mr-2" />
                New Thread
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Thread</DialogTitle>
              </DialogHeader>
              <NewThreadDialog
                truckId={truckId}
                onSuccess={(threadId) => {
                  setSelectedThreadId(threadId)
                  setShowNewThread(false)
                }}
                onCancel={() => setShowNewThread(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Main Board Layout */}
        <div className="grid grid-cols-12 gap-6 min-h-[600px]">
          {/* Thread List - Left Column */}
          <div className="col-span-12 md:col-span-4 lg:col-span-3">
            <ThreadList
              truckId={truckId}
              selectedThreadId={selectedThreadId}
              onSelectThread={setSelectedThreadId}
            />
          </div>

          {/* Thread View - Right Column */}
          <div className="col-span-12 md:col-span-8 lg:col-span-9">
            {selectedThreadId ? (
              <ThreadView
                threadId={selectedThreadId}
                onThreadDeleted={() => setSelectedThreadId(null)}
              />
            ) : (
              <div className="h-full rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select a thread to view
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Choose a thread from the list or create a new one to get started.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setShowNewThread(true)}
                    className="text-blue-600 border-blue-200 hover:bg-blue-50 relative z-10 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Thread
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}