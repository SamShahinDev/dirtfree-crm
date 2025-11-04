/**
 * Chatbot Response Templates
 *
 * Manages canned responses, variable substitution, and escalation logic
 * for the customer support chatbot.
 */

/**
 * Supported intent types
 */
export type IntentType =
  | 'appointment_query'
  | 'reschedule_request'
  | 'billing_question'
  | 'service_inquiry'
  | 'hours_inquiry'
  | 'pricing_question'
  | 'general_question'
  | 'unknown'

/**
 * Response template with metadata
 */
export interface ResponseTemplate {
  intent: IntentType
  templates: string[]
  requiresEscalation: boolean
  escalationThreshold: number
  variables?: string[]
  followUpQuestions?: string[]
}

/**
 * Context variables for response generation
 */
export interface ResponseContext {
  customerName?: string
  appointmentDate?: string
  appointmentTime?: string
  serviceType?: string
  balance?: string
  nextAppointment?: string
  businessHours?: string
  businessPhone?: string
  businessEmail?: string
  [key: string]: string | undefined
}

/**
 * Response generation result
 */
export interface GeneratedResponse {
  text: string
  shouldEscalate: boolean
  followUpQuestions?: string[]
  intent: IntentType
  confidence: number
}

/**
 * Response templates for each intent
 */
export const RESPONSE_TEMPLATES: Record<IntentType, ResponseTemplate> = {
  appointment_query: {
    intent: 'appointment_query',
    templates: [
      "Hi {customerName}! Your next appointment is scheduled for {appointmentDate} at {appointmentTime}. We're looking forward to serving you!",
      "Hello {customerName}! I found your upcoming appointment on {appointmentDate} at {appointmentTime}. Is there anything else you'd like to know?",
      "Your next service appointment with us is on {appointmentDate} at {appointmentTime}, {customerName}. Need to make any changes?",
    ],
    requiresEscalation: false,
    escalationThreshold: 0.5,
    variables: ['customerName', 'appointmentDate', 'appointmentTime'],
    followUpQuestions: [
      'Would you like to reschedule?',
      'Do you need directions to our location?',
      'Would you like a reminder the day before?',
    ],
  },

  reschedule_request: {
    intent: 'reschedule_request',
    templates: [
      "I'd be happy to help you reschedule your appointment, {customerName}. Let me connect you with our scheduling team who can find the best time for you.",
      "No problem, {customerName}! I'm transferring you to our scheduling specialist who can help you find a new time that works better.",
      "I understand you need to reschedule. Let me get you in touch with our team who can help you select a new date and time.",
    ],
    requiresEscalation: true,
    escalationThreshold: 0.7,
    variables: ['customerName'],
    followUpQuestions: [
      'What days work best for you?',
      'Do you prefer morning or afternoon appointments?',
    ],
  },

  billing_question: {
    intent: 'billing_question',
    templates: [
      "Hi {customerName}! I can see your account information. Your current balance is {balance}. Would you like help with payment options?",
      "Hello {customerName}! According to our records, your balance is {balance}. I can help you with payment methods or connect you with our billing team.",
      "{customerName}, your account shows a balance of {balance}. Would you like to make a payment or speak with our billing department?",
    ],
    requiresEscalation: false,
    escalationThreshold: 0.6,
    variables: ['customerName', 'balance'],
    followUpQuestions: [
      'Would you like to make a payment now?',
      'Do you have questions about a specific charge?',
      'Would you like to set up a payment plan?',
    ],
  },

  service_inquiry: {
    intent: 'service_inquiry',
    templates: [
      "We offer comprehensive carpet and upholstery cleaning services, {customerName}! Our main services include:\n\n• Professional Carpet Cleaning\n• Tile & Grout Cleaning\n• Upholstery Cleaning\n• Water Damage Restoration\n• Stain Removal\n• Pet Odor Treatment\n\nWhich service interests you?",
      "Great question, {customerName}! We specialize in:\n\n✓ Carpet cleaning (residential & commercial)\n✓ Tile and grout restoration\n✓ Furniture upholstery cleaning\n✓ Emergency water damage services\n✓ Pet stain and odor removal\n\nCan I provide more details on any specific service?",
      "Hi {customerName}! Dirt Free Carpet offers:\n\n• Deep carpet steam cleaning\n• Tile & grout cleaning\n• Upholstery & furniture cleaning\n• Water damage restoration\n• Specialty stain treatments\n\nWhat type of service are you looking for?",
    ],
    requiresEscalation: false,
    escalationThreshold: 0.5,
    variables: ['customerName'],
    followUpQuestions: [
      'Would you like to schedule a service?',
      'Do you need a price estimate?',
      'Would you like to know about our current specials?',
    ],
  },

  hours_inquiry: {
    intent: 'hours_inquiry',
    templates: [
      "We're here to help, {customerName}! Our business hours are:\n\n{businessHours}\n\nFor urgent service needs, please call us at {businessPhone}.",
      "Hi {customerName}! Our regular hours are {businessHours}. You can also reach us anytime at {businessPhone} for emergency services.",
      "Hello {customerName}! We operate during these hours:\n\n{businessHours}\n\nNeed immediate assistance? Call us at {businessPhone}.",
    ],
    requiresEscalation: false,
    escalationThreshold: 0.4,
    variables: ['customerName', 'businessHours', 'businessPhone'],
    followUpQuestions: [
      'Would you like to schedule an appointment?',
      'Do you need emergency service?',
    ],
  },

  pricing_question: {
    intent: 'pricing_question',
    templates: [
      "Our pricing varies based on the size and type of service, {customerName}. For an accurate quote, I can connect you with our team who can provide a free estimate based on your specific needs.",
      "Hi {customerName}! We offer competitive pricing that depends on square footage, service type, and any special treatments needed. Would you like me to have our team call you with a personalized quote?",
      "Pricing depends on several factors, {customerName}. For the most accurate estimate, I'd recommend speaking with our specialists. They can give you a detailed quote based on your exact requirements. Shall I arrange that?",
    ],
    requiresEscalation: true,
    escalationThreshold: 0.7,
    variables: ['customerName'],
    followUpQuestions: [
      'What type of service are you interested in?',
      'How many rooms need cleaning?',
      'Would you like a free on-site estimate?',
    ],
  },

  general_question: {
    intent: 'general_question',
    templates: [
      "Thanks for reaching out, {customerName}! I'm here to help with appointment scheduling, service information, and billing questions. What can I assist you with today?",
      "Hi {customerName}! I can help you with:\n• Checking your appointments\n• Learning about our services\n• Billing and payment questions\n• Business hours and contact info\n\nWhat would you like to know?",
      "Hello {customerName}! I'm your virtual assistant for Dirt Free Carpet. I can help with appointments, services, billing, and general information. How can I help you today?",
    ],
    requiresEscalation: false,
    escalationThreshold: 0.3,
    variables: ['customerName'],
    followUpQuestions: [
      'Would you like to check your upcoming appointments?',
      'Are you interested in learning about our services?',
      'Do you have billing questions?',
    ],
  },

  unknown: {
    intent: 'unknown',
    templates: [
      "I'm not quite sure I understood that, {customerName}. Could you rephrase your question? Or, I can connect you with a team member who can help directly.",
      "I want to make sure I help you correctly, {customerName}. Could you tell me more about what you need? Alternatively, I can transfer you to a specialist.",
      "I'm having trouble understanding your request, {customerName}. Would you like me to connect you with a team member for personalized assistance?",
    ],
    requiresEscalation: true,
    escalationThreshold: 0.3,
    variables: ['customerName'],
    followUpQuestions: [
      'Would you like to speak with a team member?',
      'Can you describe your question another way?',
    ],
  },
}

/**
 * Default business information for variable substitution
 */
export const DEFAULT_BUSINESS_INFO: ResponseContext = {
  businessHours: 'Monday-Friday: 8:00 AM - 6:00 PM\nSaturday: 9:00 AM - 4:00 PM\nSunday: Closed',
  businessPhone: '(555) 123-4567',
  businessEmail: 'info@dirtfreecarpet.com',
}

/**
 * Escalation triggers based on keywords
 */
export const ESCALATION_KEYWORDS = [
  'complaint',
  'unhappy',
  'disappointed',
  'angry',
  'frustrated',
  'manager',
  'supervisor',
  'speak to someone',
  'talk to person',
  'human',
  'cancel',
  'refund',
  'lawsuit',
  'attorney',
  'lawyer',
  'better business bureau',
  'bbb',
  'review',
]

/**
 * Urgency keywords that increase escalation priority
 */
export const URGENCY_KEYWORDS = [
  'emergency',
  'urgent',
  'asap',
  'immediately',
  'right now',
  'flooding',
  'water damage',
  'leak',
  'crisis',
]

/**
 * Generate response from template with variable substitution
 */
export function generateResponse(
  intent: IntentType,
  context: ResponseContext,
  confidence: number
): GeneratedResponse {
  const template = RESPONSE_TEMPLATES[intent]

  // Select random template from available options
  const randomIndex = Math.floor(Math.random() * template.templates.length)
  let responseText = template.templates[randomIndex]

  // Substitute variables
  responseText = substituteVariables(responseText, {
    ...DEFAULT_BUSINESS_INFO,
    ...context,
  })

  // Determine if escalation is needed
  const shouldEscalate =
    template.requiresEscalation ||
    confidence < template.escalationThreshold

  return {
    text: responseText,
    shouldEscalate,
    followUpQuestions: template.followUpQuestions,
    intent,
    confidence,
  }
}

/**
 * Substitute variables in template string
 */
export function substituteVariables(
  template: string,
  context: ResponseContext
): string {
  let result = template

  // Replace all {variable} placeholders with context values
  Object.keys(context).forEach((key) => {
    const value = context[key]
    if (value !== undefined) {
      const regex = new RegExp(`\\{${key}\\}`, 'g')
      result = result.replace(regex, value)
    }
  })

  // Clean up any remaining unreplaced variables
  result = result.replace(/\{[^}]+\}/g, '[not available]')

  return result
}

/**
 * Check if message contains escalation triggers
 */
export function shouldEscalateMessage(message: string): {
  shouldEscalate: boolean
  reason: string
  isUrgent: boolean
} {
  const lowerMessage = message.toLowerCase()

  // Check for urgency keywords first
  const urgentKeyword = URGENCY_KEYWORDS.find(keyword =>
    lowerMessage.includes(keyword)
  )

  if (urgentKeyword) {
    return {
      shouldEscalate: true,
      reason: `Urgent keyword detected: ${urgentKeyword}`,
      isUrgent: true,
    }
  }

  // Check for escalation keywords
  const escalationKeyword = ESCALATION_KEYWORDS.find(keyword =>
    lowerMessage.includes(keyword)
  )

  if (escalationKeyword) {
    return {
      shouldEscalate: true,
      reason: `Escalation keyword detected: ${escalationKeyword}`,
      isUrgent: false,
    }
  }

  return {
    shouldEscalate: false,
    reason: '',
    isUrgent: false,
  }
}

/**
 * Get escalation message
 */
export function getEscalationMessage(
  customerName: string,
  isUrgent: boolean = false
): string {
  if (isUrgent) {
    return `I understand this is urgent, ${customerName}. Let me immediately connect you with a team member who can provide immediate assistance. Please hold for just a moment.`
  }

  return `I'll connect you with one of our specialists who can better assist you, ${customerName}. They'll be with you shortly!`
}

/**
 * Format confidence score as percentage
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

/**
 * Get response template for intent
 */
export function getResponseTemplate(intent: IntentType): ResponseTemplate {
  return RESPONSE_TEMPLATES[intent]
}

/**
 * Validate response context has required variables
 */
export function validateContext(
  intent: IntentType,
  context: ResponseContext
): { valid: boolean; missing: string[] } {
  const template = RESPONSE_TEMPLATES[intent]
  const missing: string[] = []

  if (template.variables) {
    template.variables.forEach((variable) => {
      if (!context[variable] && !DEFAULT_BUSINESS_INFO[variable]) {
        missing.push(variable)
      }
    })
  }

  return {
    valid: missing.length === 0,
    missing,
  }
}
