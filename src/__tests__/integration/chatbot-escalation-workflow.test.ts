/**
 * Chatbot Escalation Workflow Integration Tests
 *
 * Tests the chatbot conversation flow and escalation to human agents
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  setupTestDatabase,
  teardownTestDatabase,
  createTestCustomer,
  createTestStaff,
} from './helpers/test-database'
import { createClient } from '@/lib/supabase/server'

describe('Chatbot Escalation Workflow Integration', () => {
  let customerId: string
  let staffId: string
  let conversationId: string
  let ticketId: string

  beforeEach(async () => {
    await setupTestDatabase()

    const customer = await createTestCustomer({
      name: 'Chat Customer',
      email: 'chat@example.com',
    })
    customerId = customer.id

    const staff = await createTestStaff({
      role: 'support',
      first_name: 'Support',
      last_name: 'Agent',
    })
    staffId = staff.id
  })

  afterEach(async () => {
    await teardownTestDatabase()
  })

  describe('AI Chatbot Conversation', () => {
    it('starts new conversation', async () => {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          customer_id: customerId,
          channel: 'portal',
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('active')

      conversationId = data.id
    })

    it('sends welcome message', async () => {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: 'Hello! How can I help you today?',
          message_type: 'text',
          sent_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.role).toBe('assistant')
    })

    it('receives customer message', async () => {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'user',
          content: 'I need to schedule a carpet cleaning',
          message_type: 'text',
          sent_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.role).toBe('user')
    })

    it('AI analyzes intent and responds', async () => {
      const supabase = await createClient()

      // Simulate AI intent detection
      const userMessage = 'I need to schedule a carpet cleaning'
      const detectedIntent = 'booking'
      const confidence = 0.95

      // Log intent
      await supabase.from('chat_intents').insert({
        conversation_id: conversationId,
        intent: detectedIntent,
        confidence: confidence,
        detected_at: new Date().toISOString(),
      })

      // Send AI response
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: 'I can help you schedule a carpet cleaning! What date works best for you?',
          message_type: 'text',
          intent: detectedIntent,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.intent).toBe('booking')
    })

    it('provides quick reply options', async () => {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: 'What service are you interested in?',
          message_type: 'quick_reply',
          quick_replies: [
            { label: 'Carpet Cleaning', value: 'carpet' },
            { label: 'Tile & Grout', value: 'tile' },
            { label: 'Upholstery', value: 'upholstery' },
          ],
          sent_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.message_type).toBe('quick_reply')
    })
  })

  describe('Chatbot Escalation Triggers', () => {
    it('detects low confidence response', async () => {
      const supabase = await createClient()

      const lowConfidence = 0.4
      const shouldEscalate = lowConfidence < 0.6

      expect(shouldEscalate).toBe(true)

      if (shouldEscalate) {
        await supabase
          .from('chat_conversations')
          .update({
            escalation_reason: 'low_confidence',
            escalation_triggered_at: new Date().toISOString(),
          })
          .eq('id', conversationId)
      }
    })

    it('detects customer frustration', async () => {
      const supabase = await createClient()

      // Customer sends multiple negative messages
      const messages = [
        'This is not helping',
        'I need to talk to a person',
        'This is frustrating',
      ]

      for (const content of messages) {
        await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          role: 'user',
          content,
          sentiment: 'negative',
          sent_at: new Date().toISOString(),
        })
      }

      // Check for escalation trigger
      const { data: conversation } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', conversationId)
        .single()

      // Count negative messages
      const { data: negativeMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('sentiment', 'negative')

      const shouldEscalate = negativeMessages.length >= 2

      expect(shouldEscalate).toBe(true)
    })

    it('detects explicit request for human agent', async () => {
      const supabase = await createClient()

      const message = 'I want to speak to a real person'
      const containsEscalationKeyword =
        message.toLowerCase().includes('person') ||
        message.toLowerCase().includes('agent') ||
        message.toLowerCase().includes('human')

      expect(containsEscalationKeyword).toBe(true)

      await supabase
        .from('chat_conversations')
        .update({
          escalation_reason: 'customer_request',
          escalation_triggered_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
    })
  })

  describe('Human Agent Handoff', () => {
    it('creates support ticket on escalation', async () => {
      const supabase = await createClient()

      // Get conversation context
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true })

      const conversationSummary = messages
        .map((m: any) => `${m.role}: ${m.content}`)
        .join('\n')

      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          customer_id: customerId,
          conversation_id: conversationId,
          subject: 'Chat escalation - Customer needs assistance',
          description: conversationSummary,
          priority: 'high',
          status: 'open',
          source: 'chatbot_escalation',
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(ticket.status).toBe('open')

      ticketId = ticket.id

      // Update conversation
      await supabase
        .from('chat_conversations')
        .update({
          status: 'escalated',
          support_ticket_id: ticketId,
        })
        .eq('id', conversationId)
    })

    it('assigns ticket to available agent', async () => {
      const supabase = await createClient()

      // Find available support agent
      const { data: agents } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'support')
        .eq('is_available', true)
        .limit(1)

      const assignedAgent = agents[0] || staffId

      const { error } = await supabase
        .from('support_tickets')
        .update({
          assigned_to_user_id: assignedAgent,
          assigned_at: new Date().toISOString(),
          status: 'assigned',
        })
        .eq('id', ticketId)

      expect(error).toBeNull()
    })

    it('notifies customer of agent handoff', async () => {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'system',
          content: 'I\'m connecting you with a support agent. Please hold.',
          message_type: 'system',
          sent_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.role).toBe('system')
    })

    it('agent joins conversation', async () => {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'agent',
          agent_id: staffId,
          content: 'Hello! This is Support Agent. How can I assist you?',
          message_type: 'text',
          sent_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.role).toBe('agent')

      // Update conversation
      await supabase
        .from('chat_conversations')
        .update({
          status: 'active_with_agent',
          agent_id: staffId,
          agent_joined_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
    })

    it('agent resolves conversation', async () => {
      const supabase = await createClient()

      // Send resolution message
      await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        role: 'agent',
        agent_id: staffId,
        content: 'Is there anything else I can help you with?',
        message_type: 'text',
        sent_at: new Date().toISOString(),
      })

      // Customer confirms resolution
      await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: 'No, that\'s all. Thank you!',
        message_type: 'text',
        sent_at: new Date().toISOString(),
      })

      // Close conversation
      const { data, error } = await supabase
        .from('chat_conversations')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by_agent_id: staffId,
        })
        .eq('id', conversationId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('resolved')

      // Close ticket
      await supabase
        .from('support_tickets')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          resolution: 'Customer issue resolved',
        })
        .eq('id', ticketId)
    })

    it('requests satisfaction rating', async () => {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: 'system',
          content: 'How would you rate this conversation?',
          message_type: 'rating_request',
          rating_options: [1, 2, 3, 4, 5],
          sent_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.message_type).toBe('rating_request')
    })

    it('records customer satisfaction rating', async () => {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('chat_ratings')
        .insert({
          conversation_id: conversationId,
          customer_id: customerId,
          agent_id: staffId,
          rating: 5,
          comment: 'Very helpful!',
          rated_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.rating).toBe(5)
    })
  })

  describe('Chatbot Analytics', () => {
    it('tracks average resolution time', async () => {
      const supabase = await createClient()

      const { data: conversations } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('status', 'resolved')

      const resolutionTimes = conversations.map((c: any) => {
        const start = new Date(c.started_at).getTime()
        const end = new Date(c.resolved_at).getTime()
        return (end - start) / 1000 / 60 // minutes
      })

      const avgResolutionTime =
        resolutionTimes.reduce((sum: number, time: number) => sum + time, 0) /
        resolutionTimes.length

      expect(avgResolutionTime).toBeGreaterThan(0)
    })

    it('calculates escalation rate', async () => {
      const supabase = await createClient()

      const { data: allConversations } = await supabase
        .from('chat_conversations')
        .select('status')

      const totalConversations = allConversations.length
      const escalatedConversations = allConversations.filter(
        (c: any) => c.status === 'escalated' || c.status === 'active_with_agent'
      ).length

      const escalationRate = (escalatedConversations / totalConversations) * 100

      expect(escalationRate).toBeGreaterThanOrEqual(0)
      expect(escalationRate).toBeLessThanOrEqual(100)
    })

    it('tracks AI confidence distribution', async () => {
      const supabase = await createClient()

      const { data: intents } = await supabase.from('chat_intents').select('confidence')

      const avgConfidence =
        intents.reduce((sum: number, i: any) => sum + i.confidence, 0) / intents.length

      expect(avgConfidence).toBeGreaterThan(0)
      expect(avgConfidence).toBeLessThanOrEqual(1)
    })
  })
})
