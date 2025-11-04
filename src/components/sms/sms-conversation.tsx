'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, MessageSquare, Phone, X, ChevronLeft, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { formatDistance } from 'date-fns'
import { sendSmsAction, getSmsConversationAction } from '@/app/actions/sms'

interface SmsMessage {
  id: string
  body: string
  direction: 'inbound' | 'outbound'
  status: string
  created_at: string
  from_name?: string
}

interface SmsConversationProps {
  customerId: string
  customerName: string
  customerPhone: string
  jobId?: string
  isOpen?: boolean
  onClose?: () => void
  className?: string
  embedded?: boolean
}

export function SmsConversation({
  customerId,
  customerName,
  customerPhone,
  jobId,
  isOpen = true,
  onClose,
  className,
  embedded = false
}: SmsConversationProps) {
  const [messages, setMessages] = useState<SmsMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load conversation history
  useEffect(() => {
    loadConversation()
  }, [customerId])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const loadConversation = async () => {
    setIsLoading(true)
    try {
      const conversation = await getSmsConversationAction(customerId)
      setMessages(conversation)
    } catch (error) {
      console.error('Failed to load conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return

    const tempMessage: SmsMessage = {
      id: `temp-${Date.now()}`,
      body: newMessage,
      direction: 'outbound',
      status: 'sending',
      created_at: new Date().toISOString(),
      from_name: 'Dirt Free'
    }

    setMessages(prev => [...prev, tempMessage])
    setNewMessage('')
    setIsSending(true)

    try {
      const result = await sendSmsAction({
        to: customerPhone,
        message: newMessage,
        customerId,
        jobId
      })

      if (result.success) {
        // Update temp message with real data
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempMessage.id
              ? { ...msg, id: result.sid || msg.id, status: 'sent' }
              : msg
          )
        )
      } else {
        // Remove failed message
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id))
        console.error('Failed to send SMS:', result.error)
      }
    } catch (error) {
      // Remove failed message
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id))
      console.error('Failed to send SMS:', error)
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge variant="success" className="text-xs">Delivered</Badge>
      case 'sent':
        return <Badge variant="secondary" className="text-xs">Sent</Badge>
      case 'failed':
        return <Badge variant="destructive" className="text-xs">Failed</Badge>
      case 'sending':
        return <Badge variant="outline" className="text-xs">Sending...</Badge>
      default:
        return null
    }
  }

  if (!isOpen && !embedded) return null

  const conversationContent = (
    <>
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {!embedded && onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="md:hidden"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <Avatar>
              <AvatarFallback>
                {customerName.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{customerName}</p>
              <p className="text-sm text-muted-foreground">{customerPhone}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon">
              <Phone className="h-5 w-5" />
            </Button>
            {!embedded && onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="hidden md:flex"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Loading conversation...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No messages yet</p>
            <p className="text-sm text-muted-foreground">Send a message to start the conversation</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  message.direction === 'outbound' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[70%] rounded-lg px-4 py-2',
                    message.direction === 'outbound'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.body}
                  </p>
                  <div className="flex items-center justify-between mt-1 space-x-2">
                    <p className="text-xs opacity-70">
                      {formatDistance(new Date(message.created_at), new Date(), {
                        addSuffix: true
                      })}
                    </p>
                    {message.direction === 'outbound' && getStatusBadge(message.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t bg-background p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage()
          }}
          className="flex space-x-2"
        >
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={isSending}
            className="flex-1"
          />
          <Button type="submit" disabled={!newMessage.trim() || isSending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          SMS charges may apply. Standard messaging rates.
        </p>
      </div>
    </>
  )

  if (embedded) {
    return <div className={cn('flex flex-col h-full', className)}>{conversationContent}</div>
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-background md:inset-auto md:right-4 md:bottom-4 md:w-96 md:h-[600px] md:rounded-lg md:shadow-xl md:border flex flex-col',
        className
      )}
    >
      {conversationContent}
    </div>
  )
}

// SMS Conversation Panel for customer detail pages
export function SmsConversationPanel({
  customerId,
  customerName,
  customerPhone,
  jobId
}: {
  customerId: string
  customerName: string
  customerPhone: string
  jobId?: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="flex items-center space-x-2"
      >
        <MessageSquare className="h-4 w-4" />
        <span>Send SMS</span>
      </Button>

      {isOpen && (
        <SmsConversation
          customerId={customerId}
          customerName={customerName}
          customerPhone={customerPhone}
          jobId={jobId}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}