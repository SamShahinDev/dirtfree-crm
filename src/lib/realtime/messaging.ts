/**
 * Real-Time Messaging Library
 *
 * Manages Supabase Realtime subscriptions for messaging features:
 * - New message notifications
 * - Read receipts
 * - Typing indicators
 * - Online/offline presence
 * - Message delivery confirmation
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

/**
 * Message event data
 */
export interface MessageEvent {
  id: string
  conversationId: string
  content: string
  senderType: 'customer' | 'staff'
  senderId: string
  createdAt: string
  attachments?: any[]
}

/**
 * Read receipt event
 */
export interface ReadReceiptEvent {
  id: string
  messageId: string
  readByUserId?: string
  readByCustomerId?: string
  readAt: string
}

/**
 * Typing indicator event
 */
export interface TypingIndicatorEvent {
  id: string
  conversationId: string
  userId?: string
  customerId?: string
  isTyping: boolean
  startedAt: string
  expiresAt: string
}

/**
 * Presence event
 */
export interface PresenceEvent {
  id: string
  userId?: string
  customerId?: string
  status: 'online' | 'away' | 'offline'
  lastSeenAt: string
}

/**
 * Message delivery status event
 */
export interface DeliveryStatusEvent {
  id: string
  messageId: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  recipientType: 'customer' | 'staff'
  recipientId: string
  deliveredAt?: string
  readAt?: string
  failedReason?: string
}

/**
 * Event handlers for realtime subscriptions
 */
export interface RealtimeEventHandlers {
  onMessage?: (message: MessageEvent) => void
  onReadReceipt?: (receipt: ReadReceiptEvent) => void
  onTyping?: (indicator: TypingIndicatorEvent) => void
  onPresence?: (presence: PresenceEvent) => void
  onDeliveryStatus?: (status: DeliveryStatusEvent) => void
  onError?: (error: Error) => void
}

/**
 * Realtime messaging manager class
 */
export class RealtimeMessagingManager {
  private supabase: SupabaseClient
  private channels: Map<string, RealtimeChannel> = new Map()
  private presence: Map<string, any> = new Map()

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  /**
   * Subscribe to messages for a customer
   */
  subscribeToCustomerMessages(
    customerId: string,
    handlers: RealtimeEventHandlers
  ): RealtimeChannel {
    const channelName = `customer:${customerId}:messages`

    // Remove existing channel if any
    this.unsubscribe(channelName)

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customer_messages',
          filter: `customer_id=eq.${customerId}`,
        },
        (payload) => {
          if (handlers.onMessage) {
            const message: MessageEvent = {
              id: payload.new.id,
              conversationId: payload.new.conversation_id || customerId,
              content: payload.new.content,
              senderType: payload.new.sender_type,
              senderId: payload.new.sender_id,
              createdAt: payload.new.created_at,
              attachments: payload.new.attachments,
            }
            handlers.onMessage(message)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_read_receipts',
        },
        (payload) => {
          if (handlers.onReadReceipt) {
            const receipt: ReadReceiptEvent = {
              id: payload.new.id,
              messageId: payload.new.message_id,
              readByUserId: payload.new.read_by_user_id,
              readByCustomerId: payload.new.read_by_customer_id,
              readAt: payload.new.read_at,
            }
            handlers.onReadReceipt(receipt)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_typing_indicators',
          filter: `customer_id=eq.${customerId}`,
        },
        (payload) => {
          if (handlers.onTyping) {
            const data = payload.new || payload.old || {}
            const indicator: TypingIndicatorEvent = {
              id: (data as any).id,
              conversationId: (data as any).conversation_id,
              userId: (data as any).user_id,
              customerId: (data as any).customer_id,
              isTyping: (data as any).is_typing,
              startedAt: (data as any).started_at,
              expiresAt: (data as any).expires_at,
            }
            handlers.onTyping(indicator)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_delivery_status',
        },
        (payload) => {
          if (handlers.onDeliveryStatus) {
            const data = payload.new || payload.old || {}
            const status: DeliveryStatusEvent = {
              id: (data as any).id,
              messageId: (data as any).message_id,
              status: (data as any).status,
              recipientType: (data as any).recipient_type,
              recipientId: (data as any).recipient_id,
              deliveredAt: (data as any).delivered_at,
              readAt: (data as any).read_at,
              failedReason: (data as any).failed_reason,
            }
            handlers.onDeliveryStatus(status)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to customer messages:', customerId)
        } else if (status === 'CHANNEL_ERROR') {
          if (handlers.onError) {
            handlers.onError(new Error('Channel subscription error'))
          }
        }
      })

    this.channels.set(channelName, channel)
    return channel
  }

  /**
   * Subscribe to messages for a staff user
   */
  subscribeToStaffMessages(
    userId: string,
    handlers: RealtimeEventHandlers
  ): RealtimeChannel {
    const channelName = `user:${userId}:messages`

    // Remove existing channel if any
    this.unsubscribe(channelName)

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customer_messages',
          filter: `sender_type=eq.customer`, // Staff sees all customer messages
        },
        (payload) => {
          if (handlers.onMessage) {
            const message: MessageEvent = {
              id: payload.new.id,
              conversationId: payload.new.conversation_id || payload.new.customer_id,
              content: payload.new.content,
              senderType: payload.new.sender_type,
              senderId: payload.new.sender_id,
              createdAt: payload.new.created_at,
              attachments: payload.new.attachments,
            }
            handlers.onMessage(message)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_read_receipts',
        },
        (payload) => {
          if (handlers.onReadReceipt) {
            const receipt: ReadReceiptEvent = {
              id: payload.new.id,
              messageId: payload.new.message_id,
              readByUserId: payload.new.read_by_user_id,
              readByCustomerId: payload.new.read_by_customer_id,
              readAt: payload.new.read_at,
            }
            handlers.onReadReceipt(receipt)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_typing_indicators',
        },
        (payload) => {
          if (handlers.onTyping) {
            const data = payload.new || payload.old || {}
            const indicator: TypingIndicatorEvent = {
              id: (data as any).id,
              conversationId: (data as any).conversation_id,
              userId: (data as any).user_id,
              customerId: (data as any).customer_id,
              isTyping: (data as any).is_typing,
              startedAt: (data as any).started_at,
              expiresAt: (data as any).expires_at,
            }
            handlers.onTyping(indicator)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to staff messages:', userId)
        } else if (status === 'CHANNEL_ERROR') {
          if (handlers.onError) {
            handlers.onError(new Error('Channel subscription error'))
          }
        }
      })

    this.channels.set(channelName, channel)
    return channel
  }

  /**
   * Subscribe to a specific conversation
   */
  subscribeToConversation(
    conversationId: string,
    handlers: RealtimeEventHandlers
  ): RealtimeChannel {
    const channelName = `conversation:${conversationId}`

    // Remove existing channel if any
    this.unsubscribe(channelName)

    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customer_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (handlers.onMessage) {
            const message: MessageEvent = {
              id: payload.new.id,
              conversationId: payload.new.conversation_id,
              content: payload.new.content,
              senderType: payload.new.sender_type,
              senderId: payload.new.sender_id,
              createdAt: payload.new.created_at,
              attachments: payload.new.attachments,
            }
            handlers.onMessage(message)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_typing_indicators',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (handlers.onTyping) {
            const data = payload.new || payload.old || {}
            const indicator: TypingIndicatorEvent = {
              id: (data as any).id,
              conversationId: (data as any).conversation_id,
              userId: (data as any).user_id,
              customerId: (data as any).customer_id,
              isTyping: (data as any).is_typing,
              startedAt: (data as any).started_at,
              expiresAt: (data as any).expires_at,
            }
            handlers.onTyping(indicator)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to conversation:', conversationId)
        } else if (status === 'CHANNEL_ERROR') {
          if (handlers.onError) {
            handlers.onError(new Error('Channel subscription error'))
          }
        }
      })

    this.channels.set(channelName, channel)
    return channel
  }

  /**
   * Subscribe to presence for a conversation
   */
  subscribeToPresence(
    conversationId: string,
    userId?: string,
    customerId?: string,
    onPresenceChange?: (presence: Map<string, any>) => void
  ): RealtimeChannel {
    const channelName = `presence:${conversationId}`

    // Remove existing channel if any
    this.unsubscribe(channelName)

    const channel = this.supabase
      .channel(channelName)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        this.presence.set(conversationId, state)
        if (onPresenceChange) {
          onPresenceChange(new Map(Object.entries(state)))
        }
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[Realtime] User joined:', key, newPresences)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[Realtime] User left:', key, leftPresences)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Subscribed to presence:', conversationId)
          // Track our own presence
          await channel.track({
            user_id: userId,
            customer_id: customerId,
            online_at: new Date().toISOString(),
          })
        }
      })

    this.channels.set(channelName, channel)
    return channel
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(
    conversationId: string,
    userId?: string,
    customerId?: string,
    isTyping: boolean = true
  ): Promise<void> {
    try {
      await this.supabase.rpc('update_typing_indicator', {
        p_conversation_id: conversationId,
        p_user_id: userId || null,
        p_customer_id: customerId || null,
        p_is_typing: isTyping,
        p_expires_in_seconds: 5,
      } as any)
    } catch (error) {
      console.error('[Realtime] Error sending typing indicator:', error)
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(
    messageId: string,
    userId?: string,
    customerId?: string
  ): Promise<void> {
    try {
      await this.supabase.rpc('mark_message_as_read', {
        p_message_id: messageId,
        p_reader_user_id: userId || null,
        p_reader_customer_id: customerId || null,
      } as any)
    } catch (error) {
      console.error('[Realtime] Error marking message as read:', error)
    }
  }

  /**
   * Update presence status
   */
  async updatePresence(
    userId?: string,
    customerId?: string,
    status: 'online' | 'away' | 'offline' = 'online',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await this.supabase.rpc('update_user_presence', {
        p_user_id: userId || null,
        p_customer_id: customerId || null,
        p_status: status,
        p_metadata: metadata || {},
      } as any)
    } catch (error) {
      console.error('[Realtime] Error updating presence:', error)
    }
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(userId?: string, customerId?: string): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc('get_unread_message_count', {
        p_user_id: userId || null,
        p_customer_id: customerId || null,
      } as any)

      if (error) {
        console.error('[Realtime] Error getting unread count:', error)
        return 0
      }

      return data || 0
    } catch (error) {
      console.error('[Realtime] Error getting unread count:', error)
      return 0
    }
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channelName: string): void {
    const channel = this.channels.get(channelName)
    if (channel) {
      this.supabase.removeChannel(channel)
      this.channels.delete(channelName)
      console.log('[Realtime] Unsubscribed from:', channelName)
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    this.channels.forEach((channel, name) => {
      this.supabase.removeChannel(channel)
      console.log('[Realtime] Unsubscribed from:', name)
    })
    this.channels.clear()
  }

  /**
   * Get current presence for a conversation
   */
  getPresence(conversationId: string): Map<string, any> {
    return this.presence.get(conversationId) || new Map()
  }

  /**
   * Check if a user/customer is online in a conversation
   */
  isOnline(conversationId: string, userId?: string, customerId?: string): boolean {
    const presence = this.getPresence(conversationId)
    for (const [, value] of presence.entries()) {
      const presenceArray = Array.isArray(value) ? value : [value]
      for (const p of presenceArray) {
        if (p.user_id === userId || p.customer_id === customerId) {
          return true
        }
      }
    }
    return false
  }
}

/**
 * Create a new realtime messaging manager
 */
export function createRealtimeManager(
  supabaseUrl: string,
  supabaseKey: string
): RealtimeMessagingManager {
  return new RealtimeMessagingManager(supabaseUrl, supabaseKey)
}

/**
 * Singleton instance for client-side use
 */
let globalManager: RealtimeMessagingManager | null = null

/**
 * Get global realtime manager (client-side only)
 */
export function getRealtimeManager(): RealtimeMessagingManager {
  if (typeof window === 'undefined') {
    throw new Error('getRealtimeManager can only be called on the client side')
  }

  if (!globalManager) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    globalManager = new RealtimeMessagingManager(supabaseUrl, supabaseKey)
  }

  return globalManager
}
