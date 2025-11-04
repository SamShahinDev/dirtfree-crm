/**
 * AI Chatbot Core Engine
 *
 * Handles intent detection, confidence scoring, response generation,
 * context management, and conversation history tracking.
 */

import { getServiceSupabase } from '@/lib/supabase/server'
import {
  IntentType,
  ResponseContext,
  GeneratedResponse,
  generateResponse,
  shouldEscalateMessage,
  getEscalationMessage,
  substituteVariables,
} from './responses'

/**
 * Intent pattern matching configuration
 */
interface IntentPattern {
  intent: IntentType
  keywords: string[]
  phrases: string[]
  weight: number
}

/**
 * Intent detection result
 */
export interface IntentDetectionResult {
  intent: IntentType
  confidence: number
  matchedKeywords: string[]
  shouldEscalate: boolean
  escalationReason?: string
  isUrgent: boolean
}

/**
 * Chatbot message
 */
export interface ChatbotMessage {
  role: 'customer' | 'bot' | 'system'
  content: string
  timestamp: Date
  intent?: IntentType
  confidence?: number
}

/**
 * Chatbot session context
 */
export interface ChatbotContext {
  sessionId: string
  customerId?: string
  customerName?: string
  conversationHistory: ChatbotMessage[]
  context: ResponseContext
  lastIntent?: IntentType
  escalated: boolean
  metadata: Record<string, any>
}

/**
 * Intent patterns for keyword matching
 */
const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'appointment_query',
    keywords: ['appointment', 'scheduled', 'booking', 'reservation', 'when'],
    phrases: [
      'when is my appointment',
      'what time is my appointment',
      'do i have an appointment',
      'next appointment',
      'upcoming appointment',
      'appointment date',
      'appointment time',
    ],
    weight: 1.0,
  },
  {
    intent: 'reschedule_request',
    keywords: ['reschedule', 'change', 'move', 'different time', 'cancel', 'postpone'],
    phrases: [
      'reschedule my appointment',
      'change appointment',
      'move my appointment',
      'need to reschedule',
      'change the time',
      'different date',
      'cancel and reschedule',
    ],
    weight: 1.2,
  },
  {
    intent: 'billing_question',
    keywords: ['bill', 'invoice', 'payment', 'charge', 'cost', 'pay', 'owe', 'balance'],
    phrases: [
      'how much do i owe',
      'my bill',
      'payment options',
      'what do i owe',
      'invoice amount',
      'make a payment',
      'billing question',
      'account balance',
    ],
    weight: 1.1,
  },
  {
    intent: 'service_inquiry',
    keywords: ['service', 'services', 'offer', 'provide', 'do you', 'clean', 'cleaning'],
    phrases: [
      'what services do you offer',
      'what do you do',
      'types of cleaning',
      'services available',
      'what can you clean',
      'do you offer',
      'carpet cleaning',
      'tile cleaning',
      'upholstery',
    ],
    weight: 0.9,
  },
  {
    intent: 'hours_inquiry',
    keywords: ['hours', 'open', 'closed', 'available', 'when', 'time'],
    phrases: [
      'what are your hours',
      'when are you open',
      'business hours',
      'are you open',
      'what time do you close',
      'operating hours',
      'hours of operation',
    ],
    weight: 1.0,
  },
  {
    intent: 'pricing_question',
    keywords: ['price', 'pricing', 'cost', 'how much', 'quote', 'estimate', 'rate'],
    phrases: [
      'how much does it cost',
      'what are your prices',
      'get a quote',
      'price for',
      'how much for',
      'what do you charge',
      'pricing information',
      'cost estimate',
    ],
    weight: 1.1,
  },
]

/**
 * Chatbot Engine Class
 */
export class ChatbotEngine {
  private context: ChatbotContext

  constructor(sessionId: string, customerId?: string) {
    this.context = {
      sessionId,
      customerId,
      conversationHistory: [],
      context: {},
      escalated: false,
      metadata: {},
    }
  }

  /**
   * Initialize chatbot session with customer data
   */
  async initialize(): Promise<void> {
    if (this.context.customerId) {
      await this.loadCustomerContext()
    }
    await this.loadSessionHistory()
  }

  /**
   * Load customer context from database
   */
  private async loadCustomerContext(): Promise<void> {
    try {
      const supabase = getServiceSupabase()

      // Get customer details
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('first_name, last_name, email, phone')
        .eq('id', this.context.customerId!)
        .single()

      if (customerError || !customer) {
        console.error('[Chatbot] Error loading customer:', customerError)
        return
      }

      // Get next appointment
      const { data: appointment } = await supabase
        .from('appointments')
        .select('scheduled_date, scheduled_time, service_type')
        .eq('customer_id', this.context.customerId!)
        .eq('status', 'scheduled')
        .gte('scheduled_date', new Date().toISOString().split('T')[0])
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
        .limit(1)
        .single()

      // Get account balance
      const { data: balance } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('customer_id', this.context.customerId!)
        .eq('status', 'unpaid')
        .single()

      // Update context
      this.context.customerName = `${(customer as any).first_name} ${(customer as any).last_name}`.trim()
      this.context.context = {
        customerName: this.context.customerName || 'there',
        appointmentDate: appointment
          ? new Date((appointment as any).scheduled_date).toLocaleDateString()
          : undefined,
        appointmentTime: appointment ? (appointment as any).scheduled_time : undefined,
        serviceType: appointment ? (appointment as any).service_type : undefined,
        balance: balance ? `$${((balance as any).total_amount || 0).toFixed(2)}` : '$0.00',
      }
    } catch (error) {
      console.error('[Chatbot] Error loading customer context:', error)
    }
  }

  /**
   * Load session conversation history
   */
  private async loadSessionHistory(): Promise<void> {
    try {
      const supabase = getServiceSupabase()

      const { data: history, error } = await supabase.rpc(
        'get_chatbot_session_history',
        {
          p_session_id: this.context.sessionId,
          p_limit: 50,
        } as any
      )

      if (error || !history) {
        return
      }

      this.context.conversationHistory = (history as any[]).map((item) => ({
        role: item.message_type === 'customer_query' ? ('customer' as const) : ('bot' as const),
        content: item.message_type === 'customer_query' ? item.message_text : item.bot_response_text,
        timestamp: new Date(item.created_at),
        intent: item.intent_detected || undefined,
        confidence: item.confidence_score || undefined,
      }))
    } catch (error) {
      console.error('[Chatbot] Error loading session history:', error)
    }
  }

  /**
   * Process customer message and generate response
   */
  async processMessage(message: string): Promise<GeneratedResponse> {
    // Detect intent
    const detection = this.detectIntent(message)

    // Check for escalation triggers
    const escalationCheck = shouldEscalateMessage(message)
    if (escalationCheck.shouldEscalate) {
      detection.shouldEscalate = true
      detection.escalationReason = escalationCheck.reason
      detection.isUrgent = escalationCheck.isUrgent
    }

    // Generate response
    const response = generateResponse(
      detection.intent,
      this.context.context,
      detection.confidence
    )

    // Override response if escalation is needed
    if (detection.shouldEscalate || response.shouldEscalate) {
      response.text = getEscalationMessage(
        this.context.context.customerName || 'there',
        detection.isUrgent
      )
      response.shouldEscalate = true
    }

    // Log interaction to database
    await this.logInteraction(message, detection, response)

    // Update conversation history
    this.context.conversationHistory.push(
      {
        role: 'customer',
        content: message,
        timestamp: new Date(),
        intent: detection.intent,
        confidence: detection.confidence,
      },
      {
        role: 'bot',
        content: response.text,
        timestamp: new Date(),
      }
    )

    // Update last intent
    this.context.lastIntent = detection.intent

    // Escalate if needed
    if (response.shouldEscalate) {
      await this.escalateConversation()
      this.context.escalated = true
    }

    return response
  }

  /**
   * Detect intent from customer message using keyword matching
   */
  private detectIntent(message: string): IntentDetectionResult {
    const lowerMessage = message.toLowerCase()
    const matchScores: Map<IntentType, number> = new Map()
    const allMatchedKeywords: Map<IntentType, string[]> = new Map()

    // Score each intent pattern
    for (const pattern of INTENT_PATTERNS) {
      let score = 0
      const matchedKeywords: string[] = []

      // Check phrase matches (higher weight)
      for (const phrase of pattern.phrases) {
        if (lowerMessage.includes(phrase)) {
          score += 2.0 * pattern.weight
          matchedKeywords.push(phrase)
        }
      }

      // Check keyword matches
      for (const keyword of pattern.keywords) {
        if (lowerMessage.includes(keyword)) {
          score += 1.0 * pattern.weight
          matchedKeywords.push(keyword)
        }
      }

      if (score > 0) {
        matchScores.set(pattern.intent, score)
        allMatchedKeywords.set(pattern.intent, matchedKeywords)
      }
    }

    // Find best match
    let bestIntent: IntentType = 'unknown'
    let bestScore = 0

    matchScores.forEach((score, intent) => {
      if (score > bestScore) {
        bestScore = score
        bestIntent = intent
      }
    })

    // Calculate confidence (normalize score to 0-1 range)
    // Max realistic score is ~5 (multiple phrase matches)
    const confidence = bestIntent === 'unknown' ? 0.2 : Math.min(bestScore / 5.0, 1.0)

    // If confidence is too low, treat as general question
    if (confidence < 0.3 && bestIntent !== 'unknown') {
      bestIntent = 'general_question'
    }

    return {
      intent: bestIntent,
      confidence,
      matchedKeywords: allMatchedKeywords.get(bestIntent) || [],
      shouldEscalate: false,
      isUrgent: false,
    }
  }

  /**
   * Log interaction to database
   */
  private async logInteraction(
    message: string,
    detection: IntentDetectionResult,
    response: GeneratedResponse
  ): Promise<void> {
    try {
      const supabase = getServiceSupabase()

      await supabase.rpc('log_chatbot_interaction', {
        p_session_id: this.context.sessionId,
        p_customer_id: this.context.customerId || null,
        p_message_type: 'customer_query',
        p_message_text: message,
        p_intent_detected: detection.intent,
        p_confidence_score: detection.confidence,
        p_bot_response_text: response.text,
        p_metadata: {
          matched_keywords: detection.matchedKeywords,
          escalation_reason: detection.escalationReason,
          is_urgent: detection.isUrgent,
        },
      } as any)
    } catch (error) {
      console.error('[Chatbot] Error logging interaction:', error)
    }
  }

  /**
   * Escalate conversation to human support
   */
  private async escalateConversation(): Promise<void> {
    try {
      const supabase = getServiceSupabase()

      await supabase.rpc('escalate_chatbot_conversation', {
        p_session_id: this.context.sessionId,
        p_escalated_to_user_id: null, // Will be assigned by support team
      } as any)
    } catch (error) {
      console.error('[Chatbot] Error escalating conversation:', error)
    }
  }

  /**
   * Get conversation history
   */
  getHistory(): ChatbotMessage[] {
    return this.context.conversationHistory
  }

  /**
   * Get current context
   */
  getContext(): ResponseContext {
    return this.context.context
  }

  /**
   * Update context manually
   */
  updateContext(updates: Partial<ResponseContext>): void {
    this.context.context = {
      ...this.context.context,
      ...updates,
    }
  }

  /**
   * Check if conversation is escalated
   */
  isEscalated(): boolean {
    return this.context.escalated
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.context.sessionId
  }

  /**
   * End chatbot session
   */
  async endSession(
    status: 'resolved' | 'abandoned' = 'resolved',
    satisfactionRating?: number,
    feedback?: string
  ): Promise<void> {
    try {
      const supabase = getServiceSupabase()

      const { error: updateError } = await (supabase as any)
        .from('chatbot_sessions')
        .update({
          status,
          ended_at: new Date().toISOString(),
          satisfaction_rating: satisfactionRating,
          satisfaction_feedback: feedback,
        })
        .eq('session_id', this.context.sessionId)

      if (updateError) {
        throw updateError
      }
    } catch (error) {
      console.error('[Chatbot] Error ending session:', error)
    }
  }
}

/**
 * Create new chatbot engine instance
 */
export function createChatbotEngine(
  sessionId: string,
  customerId?: string
): ChatbotEngine {
  return new ChatbotEngine(sessionId, customerId)
}

/**
 * Helper: Generate unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Helper: Extract customer intent from message (for testing)
 */
export function extractIntent(message: string): IntentDetectionResult {
  const engine = new ChatbotEngine('test-session')
  return (engine as any).detectIntent(message)
}

/**
 * Helper: Test intent detection without creating full engine
 */
export function testIntentDetection(message: string): {
  intent: IntentType
  confidence: number
  matchedKeywords: string[]
} {
  const result = extractIntent(message)
  return {
    intent: result.intent,
    confidence: result.confidence,
    matchedKeywords: result.matchedKeywords,
  }
}
