'use client'

import { useState, useEffect } from 'react'
import { Bell, Check, Trash2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getServerSupabase } from '@/lib/supabase/server'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  title: string
  message: string
  notification_type: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  action_url?: string
  action_label?: string
  read: boolean
  created_at: string
}

export function StaffNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchNotifications()
    subscribeToNotifications()
  }, [])

  async function fetchNotifications() {
    try {
      const response = await fetch('/api/notifications?limit=20')
      if (!response.ok) throw new Error('Failed to fetch notifications')

      const data = await response.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  function subscribeToNotifications() {
    // TODO: Implement real-time subscription using Supabase
    // This requires setting up the supabase client and subscribing to changes
    // For now, we'll poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }

  async function markAsRead(notificationId: string) {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      })

      if (!response.ok) throw new Error('Failed to mark as read')

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  async function markAllAsRead() {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      })

      if (!response.ok) throw new Error('Failed to mark all as read')

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  function handleNotificationClick(notification: Notification) {
    if (!notification.read) {
      markAsRead(notification.id)
    }

    if (notification.action_url) {
      setOpen(false)
      router.push(notification.action_url)
    }
  }

  function getPriorityColor(priority: string) {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500'
      case 'high':
        return 'bg-orange-500'
      case 'normal':
        return 'bg-blue-500'
      case 'low':
        return 'bg-gray-500'
      default:
        return 'bg-blue-500'
    }
  }

  function getTypeIcon(type: string) {
    // You can customize icons based on notification type
    return null
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-auto py-1 px-2 text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                  onMarkRead={() => markAsRead(notification.id)}
                  getPriorityColor={getPriorityColor}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

interface NotificationItemProps {
  notification: Notification
  onClick: () => void
  onMarkRead: () => void
  getPriorityColor: (priority: string) => string
}

function NotificationItem({
  notification,
  onClick,
  onMarkRead,
  getPriorityColor,
}: NotificationItemProps) {
  return (
    <div
      className={`
        border-b p-4 cursor-pointer hover:bg-accent transition-colors
        ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div
          className={`
            h-2 w-2 rounded-full mt-2 flex-shrink-0
            ${!notification.read ? getPriorityColor(notification.priority) : 'bg-transparent'}
          `}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4
              className={`font-medium truncate ${
                !notification.read ? 'font-semibold' : ''
              }`}
            >
              {notification.title}
            </h4>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(notification.created_at), {
                addSuffix: true,
              })}
            </span>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">
            {notification.message}
          </p>

          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="text-xs">
              {notification.notification_type}
            </Badge>

            {notification.priority !== 'normal' && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  notification.priority === 'urgent'
                    ? 'border-red-500 text-red-500'
                    : notification.priority === 'high'
                    ? 'border-orange-500 text-orange-500'
                    : ''
                }`}
              >
                {notification.priority}
              </Badge>
            )}
          </div>

          {notification.action_label && (
            <div className="mt-2">
              <span className="text-sm text-primary hover:underline">
                {notification.action_label} →
              </span>
            </div>
          )}
        </div>

        {!notification.read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onMarkRead()
            }}
            aria-label="Mark as read"
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
