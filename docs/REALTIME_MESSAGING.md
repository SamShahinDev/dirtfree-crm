# Real-Time Messaging Infrastructure

Complete documentation for the real-time messaging system using Supabase Realtime.

## Table of Contents

- [Overview](#overview)
- [Database Schema](#database-schema)
- [Realtime Library](#realtime-library)
- [Subscription API](#subscription-api)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Real-Time Messaging Infrastructure provides:

1. **Live Message Updates**: Instant message delivery notifications
2. **Read Receipts**: Track when messages are read
3. **Typing Indicators**: Show when users are typing
4. **Online Presence**: Track who's online/offline
5. **Delivery Confirmation**: Message delivery status tracking

### Key Features

- **Supabase Realtime**: Built on Supabase's real-time infrastructure
- **Multi-Channel Support**: Customer, user, and conversation channels
- **Automatic Cleanup**: Expired typing indicators removed automatically
- **Connection Management**: Handles reconnections and subscriptions
- **Type-Safe**: Full TypeScript support

---

## Database Schema

### Message Read Receipts

```sql
CREATE TABLE message_read_receipts (
  id uuid PRIMARY KEY,
  message_id uuid REFERENCES customer_messages(id),
  read_by_user_id uuid REFERENCES users(id),
  read_by_customer_id uuid REFERENCES customers(id),
  read_at timestamptz DEFAULT NOW(),
  CONSTRAINT unique_message_reader UNIQUE (message_id, read_by_user_id, read_by_customer_id)
);
```

**Purpose**: Track when messages are read

**Key Points**:
- One receipt per message per reader
- Either user or customer (not both)
- Automatically cascades on deletion

### Message Typing Indicators

```sql
CREATE TABLE message_typing_indicators (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL,
  customer_id uuid REFERENCES customers(id),
  user_id uuid REFERENCES users(id),
  is_typing boolean DEFAULT true,
  started_at timestamptz DEFAULT NOW(),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz DEFAULT NOW()
);
```

**Purpose**: Show real-time typing indicators

**Key Points**:
- Expires after 5 seconds by default
- One indicator per conversation per user
- Automatically cleaned up when expired

### User Presence

```sql
CREATE TABLE user_presence (
  id uuid PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES users(id),
  customer_id uuid UNIQUE REFERENCES customers(id),
  status text CHECK (status IN ('online', 'away', 'offline')),
  last_seen_at timestamptz DEFAULT NOW(),
  metadata jsonb DEFAULT '{}'
);
```

**Purpose**: Track online/offline status

**Statuses**:
- `online`: Actively using the application
- `away`: Idle for 5+ minutes
- `offline`: Disconnected

### Message Delivery Status

```sql
CREATE TABLE message_delivery_status (
  id uuid PRIMARY KEY,
  message_id uuid REFERENCES customer_messages(id),
  status text CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  recipient_type text CHECK (recipient_type IN ('customer', 'staff')),
  recipient_id uuid NOT NULL,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_reason text
);
```

**Purpose**: Track message delivery lifecycle

**Status Flow**:
1. `sent`: Message sent to server
2. `delivered`: Message received by client
3. `read`: Message marked as read
4. `failed`: Delivery failed

---

## Realtime Library

Location: `/src/lib/realtime/messaging.ts`

### RealtimeMessagingManager Class

Main class for managing real-time subscriptions.

#### Constructor

```typescript
import { RealtimeMessagingManager } from '@/lib/realtime/messaging'

const manager = new RealtimeMessagingManager(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

#### Methods

##### subscribeToCustomerMessages

Subscribe to messages for a specific customer.

```typescript
manager.subscribeToCustomerMessages(customerId, {
  onMessage: (message) => {
    console.log('New message:', message)
  },
  onReadReceipt: (receipt) => {
    console.log('Message read:', receipt)
  },
  onTyping: (indicator) => {
    console.log('Typing indicator:', indicator)
  },
  onDeliveryStatus: (status) => {
    console.log('Delivery status:', status)
  },
  onError: (error) => {
    console.error('Error:', error)
  }
})
```

##### subscribeToStaffMessages

Subscribe to messages for staff users.

```typescript
manager.subscribeToStaffMessages(userId, {
  onMessage: (message) => {
    // Receives all customer messages
    console.log('Customer sent:', message)
  }
})
```

##### subscribeToConversation

Subscribe to a specific conversation.

```typescript
manager.subscribeToConversation(conversationId, {
  onMessage: (message) => {
    console.log('Message in conversation:', message)
  },
  onTyping: (indicator) => {
    if (indicator.isTyping) {
      console.log('User is typing...')
    }
  }
})
```

##### subscribeToPresence

Subscribe to presence updates.

```typescript
manager.subscribeToPresence(
  conversationId,
  userId,
  customerId,
  (presence) => {
    console.log('Online users:', presence)
  }
)
```

##### sendTypingIndicator

Send a typing indicator.

```typescript
await manager.sendTypingIndicator(
  conversationId,
  userId,
  customerId,
  true // isTyping
)
```

##### markMessageAsRead

Mark a message as read.

```typescript
await manager.markMessageAsRead(
  messageId,
  userId,
  customerId
)
```

##### updatePresence

Update user presence status.

```typescript
await manager.updatePresence(
  userId,
  customerId,
  'online',
  { deviceType: 'mobile' }
)
```

##### getUnreadCount

Get unread message count.

```typescript
const count = await manager.getUnreadCount(userId, customerId)
console.log(`${count} unread messages`)
```

##### unsubscribe

Unsubscribe from a specific channel.

```typescript
manager.unsubscribe('customer:uuid:messages')
```

##### unsubscribeAll

Unsubscribe from all channels.

```typescript
manager.unsubscribeAll()
```

### Event Interfaces

#### MessageEvent

```typescript
interface MessageEvent {
  id: string
  conversationId: string
  content: string
  senderType: 'customer' | 'staff'
  senderId: string
  createdAt: string
  attachments?: any[]
}
```

#### ReadReceiptEvent

```typescript
interface ReadReceiptEvent {
  id: string
  messageId: string
  readByUserId?: string
  readByCustomerId?: string
  readAt: string
}
```

#### TypingIndicatorEvent

```typescript
interface TypingIndicatorEvent {
  id: string
  conversationId: string
  userId?: string
  customerId?: string
  isTyping: boolean
  startedAt: string
  expiresAt: string
}
```

#### PresenceEvent

```typescript
interface PresenceEvent {
  id: string
  userId?: string
  customerId?: string
  status: 'online' | 'away' | 'offline'
  lastSeenAt: string
}
```

---

## Subscription API

### POST /api/messages/realtime/subscribe

Subscribe to real-time message updates.

**Authentication**: Portal Token or User Session

**Request Body**:
```json
{
  "conversationId": "uuid",
  "includePresence": true,
  "includeTyping": true,
  "includeReadReceipts": true
}
```

**Response**:
```json
{
  "success": true,
  "version": "v1",
  "timestamp": "2025-10-22T12:00:00Z",
  "data": {
    "supabaseUrl": "https://xxx.supabase.co",
    "supabaseKey": "anon-key",
    "channels": [
      "conversation:uuid",
      "presence:uuid"
    ],
    "features": {
      "messages": true,
      "readReceipts": true,
      "typing": true,
      "presence": true
    },
    "filters": {
      "userId": "uuid",
      "customerId": null,
      "conversationId": "uuid"
    }
  }
}
```

### DELETE /api/messages/realtime/subscribe

Unsubscribe from real-time updates.

**Request Body** (optional):
```json
{
  "channels": ["conversation:uuid"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Unsubscribed successfully",
    "channels": ["conversation:uuid"]
  }
}
```

---

## Usage Examples

### Example 1: Customer Portal Chat Component

```typescript
'use client'

import { useEffect, useState } from 'react'
import { getRealtimeManager } from '@/lib/realtime/messaging'

export function CustomerChat({ customerId }: { customerId: string }) {
  const [messages, setMessages] = useState<any[]>([])
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    const manager = getRealtimeManager()

    // Subscribe to customer messages
    manager.subscribeToCustomerMessages(customerId, {
      onMessage: (message) => {
        setMessages(prev => [...prev, message])
      },
      onTyping: (indicator) => {
        if (indicator.isTyping && indicator.userId) {
          setTypingUsers(prev => new Set(prev).add(indicator.userId!))
        } else if (indicator.userId) {
          setTypingUsers(prev => {
            const next = new Set(prev)
            next.delete(indicator.userId!)
            return next
          })
        }
      },
      onReadReceipt: (receipt) => {
        console.log('Message read:', receipt.messageId)
      }
    })

    return () => {
      manager.unsubscribeAll()
    }
  }, [customerId])

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      {typingUsers.size > 0 && (
        <div>Someone is typing...</div>
      )}
    </div>
  )
}
```

### Example 2: Send Typing Indicator

```typescript
'use client'

import { getRealtimeManager } from '@/lib/realtime/messaging'
import { useState, useRef } from 'react'

export function MessageInput({ conversationId, customerId }: any) {
  const [message, setMessage] = useState('')
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  const handleTyping = async () => {
    const manager = getRealtimeManager()

    // Send typing indicator
    await manager.sendTypingIndicator(conversationId, undefined, customerId, true)

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(async () => {
      await manager.sendTypingIndicator(conversationId, undefined, customerId, false)
    }, 3000)
  }

  return (
    <input
      value={message}
      onChange={(e) => {
        setMessage(e.target.value)
        handleTyping()
      }}
      placeholder="Type a message..."
    />
  )
}
```

### Example 3: Mark Messages as Read

```typescript
'use client'

import { useEffect } from 'react'
import { getRealtimeManager } from '@/lib/realtime/messaging'

export function MessageList({ messages, customerId }: any) {
  useEffect(() => {
    const manager = getRealtimeManager()

    // Mark all visible messages as read
    messages.forEach(async (message: any) => {
      if (message.senderType === 'staff') {
        await manager.markMessageAsRead(message.id, undefined, customerId)
      }
    })
  }, [messages, customerId])

  return (
    <div>
      {messages.map((msg: any) => (
        <div key={msg.id}>{msg.content}</div>
      ))}
    </div>
  )
}
```

### Example 4: Online Presence

```typescript
'use client'

import { useEffect, useState } from 'react'
import { getRealtimeManager } from '@/lib/realtime/messaging'

export function ConversationHeader({ conversationId, userId }: any) {
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    const manager = getRealtimeManager()

    // Subscribe to presence
    manager.subscribeToPresence(
      conversationId,
      undefined,
      userId,
      (presence) => {
        // Check if the other user is online
        setIsOnline(manager.isOnline(conversationId, userId))
      }
    )

    // Update our own presence
    manager.updatePresence(undefined, userId, 'online')

    return () => {
      manager.updatePresence(undefined, userId, 'offline')
      manager.unsubscribe(`presence:${conversationId}`)
    }
  }, [conversationId, userId])

  return (
    <div>
      <span>User {isOnline ? 'Online' : 'Offline'}</span>
    </div>
  )
}
```

### Example 5: Staff Dashboard with Unread Counts

```typescript
'use client'

import { useEffect, useState } from 'react'
import { getRealtimeManager } from '@/lib/realtime/messaging'

export function StaffDashboard({ userId }: { userId: string }) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const manager = getRealtimeManager()

    // Get initial unread count
    manager.getUnreadCount(userId).then(setUnreadCount)

    // Subscribe to new messages
    manager.subscribeToStaffMessages(userId, {
      onMessage: async (message) => {
        // Update unread count when new message arrives
        const count = await manager.getUnreadCount(userId)
        setUnreadCount(count)
      },
      onReadReceipt: async (receipt) => {
        // Update count when messages are read
        const count = await manager.getUnreadCount(userId)
        setUnreadCount(count)
      }
    })

    return () => {
      manager.unsubscribeAll()
    }
  }, [userId])

  return (
    <div>
      <h1>Messages ({unreadCount} unread)</h1>
    </div>
  )
}
```

### Example 6: Read Receipt Display

```typescript
export function Message({ message, customerId }: any) {
  const [readReceipts, setReadReceipts] = useState<any[]>([])

  useEffect(() => {
    const manager = getRealtimeManager()

    manager.subscribeToCustomerMessages(customerId, {
      onReadReceipt: (receipt) => {
        if (receipt.messageId === message.id) {
          setReadReceipts(prev => [...prev, receipt])
        }
      }
    })
  }, [message.id, customerId])

  return (
    <div>
      <p>{message.content}</p>
      {readReceipts.length > 0 && (
        <span>✓✓ Read</span>
      )}
    </div>
  )
}
```

---

## Best Practices

### Connection Management

1. **Subscribe on Mount, Unsubscribe on Unmount**
   ```typescript
   useEffect(() => {
     const manager = getRealtimeManager()
     manager.subscribeToConversation(conversationId, handlers)
     return () => manager.unsubscribe(`conversation:${conversationId}`)
   }, [conversationId])
   ```

2. **Handle Reconnections**
   ```typescript
   manager.subscribeToCustomerMessages(customerId, {
     onError: (error) => {
       console.error('Connection error, retrying...', error)
       // Supabase Realtime handles automatic reconnection
     }
   })
   ```

3. **Cleanup All Subscriptions**
   ```typescript
   // On logout or app unmount
   manager.unsubscribeAll()
   ```

### Typing Indicators

1. **Debounce Typing Events**
   ```typescript
   const debouncedTyping = debounce(() => {
     manager.sendTypingIndicator(conversationId, userId, customerId, true)
   }, 300)
   ```

2. **Always Stop Typing**
   ```typescript
   const stopTyping = () => {
     manager.sendTypingIndicator(conversationId, userId, customerId, false)
   }

   // On blur, submit, or timeout
   inputRef.current?.addEventListener('blur', stopTyping)
   ```

3. **Clean Up Indicators**
   - Indicators automatically expire after 5 seconds
   - Database function cleans up expired indicators
   - No manual cleanup needed

### Read Receipts

1. **Mark Visible Messages Only**
   ```typescript
   const observer = new IntersectionObserver((entries) => {
     entries.forEach(async (entry) => {
       if (entry.isIntersecting) {
         await manager.markMessageAsRead(messageId, userId, customerId)
       }
     })
   })
   ```

2. **Batch Read Receipts**
   ```typescript
   // Mark multiple messages as read
   const messages = getVisibleMessages()
   for (const message of messages) {
     await manager.markMessageAsRead(message.id, userId, customerId)
   }
   ```

3. **Don't Mark Own Messages as Read**
   ```typescript
   if (message.senderType !== 'customer') {
     await manager.markMessageAsRead(message.id, undefined, customerId)
   }
   ```

### Presence Updates

1. **Update on Activity**
   ```typescript
   const updatePresence = () => {
     manager.updatePresence(userId, customerId, 'online')
   }

   // Update every 30 seconds
   const interval = setInterval(updatePresence, 30000)

   // Update on user activity
   window.addEventListener('mousemove', updatePresence)
   window.addEventListener('keypress', updatePresence)
   ```

2. **Set Away on Idle**
   ```typescript
   let idleTimer: NodeJS.Timeout

   const resetIdleTimer = () => {
     clearTimeout(idleTimer)
     manager.updatePresence(userId, customerId, 'online')

     idleTimer = setTimeout(() => {
       manager.updatePresence(userId, customerId, 'away')
     }, 5 * 60 * 1000) // 5 minutes
   }
   ```

3. **Always Set Offline on Unmount**
   ```typescript
   useEffect(() => {
     manager.updatePresence(userId, customerId, 'online')
     return () => {
       manager.updatePresence(userId, customerId, 'offline')
     }
   }, [])
   ```

### Performance

1. **Limit Subscriptions**
   - Subscribe to specific conversations, not all messages
   - Unsubscribe from channels when not needed
   - Use presence only when necessary

2. **Throttle Updates**
   ```typescript
   const throttledUpdate = throttle((status) => {
     manager.updatePresence(userId, customerId, status)
   }, 5000) // Max once per 5 seconds
   ```

3. **Cache Unread Counts**
   ```typescript
   const [unreadCache, setUnreadCache] = useState<number | null>(null)

   const getUnreadCount = async () => {
     if (unreadCache !== null) return unreadCache
     const count = await manager.getUnreadCount(userId)
     setUnreadCache(count)
     return count
   }
   ```

---

## Troubleshooting

### Messages Not Arriving

**Symptoms**: New messages don't appear in real-time

**Solutions**:
1. Check subscription status in console logs
2. Verify RLS policies allow reading messages
3. Check if channel name is correct
4. Ensure Supabase Realtime is enabled for the table

```typescript
// Debug subscription
const channel = manager.subscribeToCustomerMessages(customerId, {
  onMessage: (msg) => console.log('Received:', msg),
  onError: (err) => console.error('Error:', err)
})

// Check channel status
console.log(channel.state)
```

### Typing Indicators Not Showing

**Symptoms**: Typing indicators don't appear

**Solutions**:
1. Check if `expires_at` is in the future
2. Verify typing indicators are enabled in subscription
3. Run cleanup function to remove expired indicators

```sql
-- Manually clean up expired indicators
SELECT cleanup_expired_typing_indicators();
```

### Presence Always Shows Offline

**Symptoms**: Users show as offline even when online

**Solutions**:
1. Ensure presence updates are being sent
2. Check if `last_seen_at` is recent
3. Verify presence channel is subscribed

```typescript
// Debug presence
const presence = manager.getPresence(conversationId)
console.log('Current presence:', presence)
```

### Connection Drops

**Symptoms**: Realtime connection frequently disconnects

**Solutions**:
1. Check network stability
2. Implement reconnection logic
3. Monitor Supabase status page

```typescript
// Monitor connection status
channel.subscribe((status) => {
  console.log('Channel status:', status)
  if (status === 'CHANNEL_ERROR') {
    // Attempt to resubscribe
    setTimeout(() => {
      manager.subscribeToConversation(conversationId, handlers)
    }, 5000)
  }
})
```

### High Database Load

**Symptoms**: Too many database queries from realtime

**Solutions**:
1. Reduce presence update frequency
2. Clean up expired typing indicators regularly
3. Use indexes on filtered columns

```sql
-- Schedule cleanup job
-- Add to cron: */5 * * * * (every 5 minutes)
SELECT cleanup_expired_typing_indicators();
```

---

## Database Functions

### mark_message_as_read

Mark a message as read and update delivery status.

```sql
SELECT mark_message_as_read(
  'message-uuid',
  NULL, -- user_id
  'customer-uuid'
);
```

### update_typing_indicator

Update or create a typing indicator.

```sql
SELECT update_typing_indicator(
  'conversation-uuid',
  'user-uuid',
  NULL, -- customer_id
  true, -- is_typing
  5 -- expires_in_seconds
);
```

### update_user_presence

Update user or customer presence status.

```sql
SELECT update_user_presence(
  'user-uuid',
  NULL, -- customer_id
  'online',
  '{"device": "mobile"}'::jsonb
);
```

### get_unread_message_count

Get unread message count for a user or customer.

```sql
SELECT get_unread_message_count(
  'user-uuid',
  NULL -- customer_id
);
```

### cleanup_expired_typing_indicators

Remove expired typing indicators.

```sql
SELECT cleanup_expired_typing_indicators();
-- Returns: number of deleted indicators
```

---

## Security Considerations

### Row Level Security (RLS)

All tables have RLS policies:

1. **Customers can only see their own data**
2. **Staff can see all data**
3. **Read receipts and typing indicators isolated by conversation**

### Authentication

- Portal customers use portal tokens
- Staff users use Supabase auth tokens
- Tokens validated on subscription

### Rate Limiting

Recommended limits:

```
Typing indicators: 10 updates/minute per conversation
Presence updates: 6 updates/minute per user
Read receipts: 60 marks/minute per user
```

### Data Privacy

- Message content encrypted in transit (TLS)
- Presence metadata should not contain sensitive info
- Read receipts don't expose message content

---

## Performance Metrics

### Expected Performance

| Metric | Target | Notes |
|--------|--------|-------|
| Message delivery latency | < 500ms | 95th percentile |
| Typing indicator delay | < 200ms | 99th percentile |
| Presence update delay | < 1s | Average |
| Read receipt delay | < 300ms | 95th percentile |
| Connection reconnect time | < 5s | After disconnect |

### Monitoring

Track these metrics:

1. **Message Delivery Rate**: Messages/second
2. **Active Connections**: Concurrent subscriptions
3. **Typing Indicator Rate**: Updates/second
4. **Presence Updates**: Updates/minute
5. **Error Rate**: Errors/total events

---

## Changelog

### v1.0.0 (2025-10-22)

- Initial release
- Message subscriptions
- Read receipts
- Typing indicators
- Online presence
- Delivery status tracking

---

## Support

For issues or questions:

1. Check console logs for errors
2. Verify Supabase Realtime is enabled
3. Check RLS policies
4. Review subscription configuration
5. Contact development team

---

## Quick Reference

### Subscription Checklist

- [ ] Subscribe on component mount
- [ ] Unsubscribe on component unmount
- [ ] Handle errors gracefully
- [ ] Update presence on mount/unmount
- [ ] Throttle typing indicators
- [ ] Mark messages as read when visible
- [ ] Clean up all subscriptions on logout

### Common Patterns

**Subscribe to conversation:**
```typescript
useEffect(() => {
  const manager = getRealtimeManager()
  manager.subscribeToConversation(conversationId, handlers)
  return () => manager.unsubscribe(`conversation:${conversationId}`)
}, [conversationId])
```

**Send typing indicator:**
```typescript
const handleTyping = debounce(() => {
  manager.sendTypingIndicator(conversationId, userId, customerId, true)
}, 300)
```

**Mark as read:**
```typescript
await manager.markMessageAsRead(messageId, userId, customerId)
```

**Update presence:**
```typescript
manager.updatePresence(userId, customerId, 'online')
```
