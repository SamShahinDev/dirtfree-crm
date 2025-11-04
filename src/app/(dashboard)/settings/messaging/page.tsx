export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/auth/guards'
import { MessagingSettings } from './_components/MessagingSettings'

export default async function MessagingSettingsPage() {
  // Admin only - redirects if not authorized
  await requireAdmin({ redirectTo: '/dashboard' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messaging Settings</h1>
        <p className="text-muted-foreground">
          Manage SMS templates with live preview and validation
        </p>
      </div>

      {/* Settings Component */}
      <MessagingSettings />
    </div>
  )
}