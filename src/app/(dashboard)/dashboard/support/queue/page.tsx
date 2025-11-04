'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  MessageSquare,
  RefreshCw,
  User,
  UserCheck,
  Send,
  Bot,
  AlertCircle,
  TrendingUp,
} from 'lucide-react'

/**
 * Support Queue Dashboard
 *
 * Features:
 * - View escalated conversations
 * - Real-time ticket updates
 * - Claim/assign tickets
 * - View conversation history
 * - Continue conversations seamlessly
 * - Filter by status, priority
 */

interface Ticket {
  id: string
  ticketNumber: string
  customerId: string | null
  customerName: string
  escalationReason: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
  assignedToUserId: string | null
  assignedToName: string | null
  createdAt: string
  unreadMessages: number
}

interface TicketDetails {
  ticket: {
    id: string
    ticketNumber: string
    customerId: string | null
    customerName: string
    customerEmail: string | null
    customerPhone: string | null
    escalationReason: string
    priority: string
    status: string
    assignedToUserId: string | null
    assignedToName: string | null
    createdAt: string
    resolvedAt: string | null
    resolutionNotes: string | null
  }
  messages: Array<{
    id: string
    senderType: string
    messageText: string
    isInternalNote: boolean
    createdAt: string
  }>
  chatbotHistory: Array<{
    messageType: string
    messageText: string
    botResponseText: string | null
    intentDetected: string | null
    confidenceScore: number | null
    createdAt: string
  }>
}

const PRIORITY_COLORS = {
  urgent: 'destructive',
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
} as const

const STATUS_COLORS = {
  open: 'destructive',
  assigned: 'default',
  in_progress: 'default',
  resolved: 'secondary',
  closed: 'secondary',
} as const

export default function SupportQueuePage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<TicketDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  // Ticket counts
  const [counts, setCounts] = useState<Record<string, number>>({})

  // Message composition
  const [messageText, setMessageText] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [sending, setSending] = useState(false)

  // Dialog state
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Fetch tickets
  const fetchTickets = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (priorityFilter !== 'all') params.append('priority', priorityFilter)

      const response = await fetch(`/api/support/tickets?${params}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch tickets')
      }

      setTickets(data.data.tickets || [])

      // Calculate counts
      const newCounts: Record<string, number> = {}
      ;(data.data.counts || []).forEach((count: any) => {
        newCounts[count.priority] = parseInt(count.count)
      })
      setCounts(newCounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }

  // Fetch ticket details
  const fetchTicketDetails = async (ticketId: string) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/support/tickets/${ticketId}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch ticket details')
      }

      setSelectedTicket(data.data)
      setDetailsOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket details')
    } finally {
      setLoading(false)
    }
  }

  // Claim ticket
  const claimTicket = async (ticketId: string, userId: string) => {
    try {
      setError(null)
      setSuccess(null)

      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          assignedToUserId: userId,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to claim ticket')
      }

      setSuccess('Ticket claimed successfully!')
      setTimeout(() => setSuccess(null), 3000)
      fetchTickets()
      if (selectedTicket) {
        fetchTicketDetails(ticketId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim ticket')
    }
  }

  // Resolve ticket
  const resolveTicket = async (ticketId: string, notes: string) => {
    try {
      setError(null)
      setSuccess(null)

      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          resolutionNotes: notes,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to resolve ticket')
      }

      setSuccess('Ticket resolved successfully!')
      setTimeout(() => setSuccess(null), 3000)
      setDetailsOpen(false)
      fetchTickets()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve ticket')
    }
  }

  // Send message
  const sendMessage = async () => {
    if (!selectedTicket || !messageText.trim()) return

    try {
      setSending(true)
      setError(null)

      const response = await fetch(`/api/support/tickets/${selectedTicket.ticket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageText: messageText.trim(),
          isInternalNote,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to send message')
      }

      setMessageText('')
      setIsInternalNote(false)
      fetchTicketDetails(selectedTicket.ticket.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  // Auto-refresh tickets
  useEffect(() => {
    fetchTickets()
    const interval = setInterval(fetchTickets, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [statusFilter, priorityFilter])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-8 w-8" />
            Support Queue
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage escalated chatbot conversations
          </p>
        </div>
        <Button onClick={fetchTickets} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Priority Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Urgent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.urgent || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              High
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.high || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Medium
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.medium || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              Low
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.low || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Ticket List */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets</CardTitle>
          <CardDescription>
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && tickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading tickets...
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No tickets found
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => fetchTicketDetails(ticket.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{ticket.ticketNumber}</span>
                      <Badge variant={PRIORITY_COLORS[ticket.priority]}>
                        {ticket.priority}
                      </Badge>
                      <Badge variant={STATUS_COLORS[ticket.status]}>
                        {ticket.status}
                      </Badge>
                      {ticket.unreadMessages > 0 && (
                        <Badge variant="destructive">
                          {ticket.unreadMessages} unread
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {ticket.customerName} • {ticket.escalationReason}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(ticket.createdAt).toLocaleString()}
                      {ticket.assignedToName && ` • Assigned to ${ticket.assignedToName}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket Details Dialog */}
      {selectedTicket && (
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedTicket.ticket.ticketNumber}
                <Badge variant={PRIORITY_COLORS[selectedTicket.ticket.priority as keyof typeof PRIORITY_COLORS]}>
                  {selectedTicket.ticket.priority}
                </Badge>
                <Badge variant={STATUS_COLORS[selectedTicket.ticket.status as keyof typeof STATUS_COLORS]}>
                  {selectedTicket.ticket.status}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {selectedTicket.ticket.customerName} • {selectedTicket.ticket.escalationReason}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="conversation" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="conversation">Conversation</TabsTrigger>
                <TabsTrigger value="chatbot-history">Chatbot History</TabsTrigger>
              </TabsList>

              <TabsContent value="conversation" className="space-y-4">
                {/* Messages */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {selectedTicket.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-3 rounded-lg ${
                        message.senderType === 'staff'
                          ? 'bg-blue-100 ml-8'
                          : 'bg-gray-100 mr-8'
                      } ${message.isInternalNote ? 'border-2 border-yellow-500' : ''}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {message.senderType === 'staff' ? (
                          <User className="h-4 w-4" />
                        ) : message.senderType === 'customer' ? (
                          <MessageSquare className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                        <span className="text-xs font-semibold capitalize">
                          {message.senderType}
                        </span>
                        {message.isInternalNote && (
                          <Badge variant="outline">Internal Note</Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(message.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{message.messageText}</p>
                    </div>
                  ))}
                </div>

                {/* Message Input */}
                <div className="space-y-2">
                  <Textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type your message..."
                    rows={3}
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                      />
                      <span className="text-sm">Internal note</span>
                    </label>
                    <Button onClick={sendMessage} disabled={sending || !messageText.trim()}>
                      <Send className="h-4 w-4 mr-2" />
                      {sending ? 'Sending...' : 'Send'}
                    </Button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {!selectedTicket.ticket.assignedToUserId && (
                    <Button
                      onClick={() => claimTicket(selectedTicket.ticket.id, 'current-user-id')}
                      variant="outline"
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Claim Ticket
                    </Button>
                  )}
                  {selectedTicket.ticket.status !== 'resolved' && (
                    <Button
                      onClick={() => {
                        const notes = prompt('Enter resolution notes:')
                        if (notes) resolveTicket(selectedTicket.ticket.id, notes)
                      }}
                      variant="default"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Resolve Ticket
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="chatbot-history" className="space-y-3">
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {selectedTicket.chatbotHistory.map((history, idx) => (
                    <div key={idx} className="space-y-2">
                      {history.messageType === 'customer_query' && (
                        <div className="p-3 rounded-lg bg-gray-100 mr-8">
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-4 w-4" />
                            <span className="text-xs font-semibold">Customer</span>
                            {history.intentDetected && (
                              <Badge variant="outline">{history.intentDetected}</Badge>
                            )}
                            {history.confidenceScore && (
                              <span className="text-xs text-muted-foreground">
                                {Math.round(history.confidenceScore * 100)}% confidence
                              </span>
                            )}
                          </div>
                          <p className="text-sm">{history.messageText}</p>
                        </div>
                      )}
                      {history.botResponseText && (
                        <div className="p-3 rounded-lg bg-blue-100 ml-8">
                          <div className="flex items-center gap-2 mb-1">
                            <Bot className="h-4 w-4" />
                            <span className="text-xs font-semibold">Chatbot</span>
                          </div>
                          <p className="text-sm">{history.botResponseText}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
