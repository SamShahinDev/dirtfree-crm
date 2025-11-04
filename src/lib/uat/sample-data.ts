/**
 * UAT Sample Data Generator
 * Provides sample data for User Acceptance Testing scenarios
 */

export interface UATCustomer {
  id: string
  name: string
  email: string
  phone: string
  address: string
  zone: string
  notes?: string
  created_at: string
  service_history: UATServiceHistory[]
}

export interface UATServiceHistory {
  date: string
  service: string
  rooms: number
  satisfaction: number
  notes?: string
}

export interface UATJob {
  id: string
  customer_id: string
  customer_name: string
  service_type: string
  rooms: string[]
  scheduled_date: string
  scheduled_time: string
  estimated_duration: string
  technician: string
  zone: string
  status: 'scheduled' | 'confirmed' | 'on_the_way' | 'in_progress' | 'completed'
  special_instructions?: string
  internal_notes?: string
}

export interface UATSMSScenario {
  id: string
  scenario_name: string
  recipient: string
  message_type: 'appointment_reminder' | 'on_the_way' | 'job_complete' | 'follow_up'
  test_conditions: string[]
  expected_behavior: string
  compliance_requirements: string[]
}

export interface UATUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'dispatcher' | 'technician'
  phone?: string
  created_at: string
}

// Sample Customers for UAT
export const uatCustomers: UATCustomer[] = [
  {
    id: 'cust_001',
    name: 'John Smith',
    email: 'john.smith@test.local',
    phone: '(555) 101-1001',
    address: '123 Main St, Test City, TC 12345',
    zone: 'Zone A',
    notes: 'Regular customer - prefers morning appointments. Has parking restrictions on street.',
    created_at: '2024-01-01T00:00:00Z',
    service_history: [
      {
        date: '2024-01-15',
        service: 'Carpet cleaning',
        rooms: 3,
        satisfaction: 5,
        notes: 'Very satisfied with service quality'
      },
      {
        date: '2024-06-15',
        service: 'Deep cleaning',
        rooms: 4,
        satisfaction: 5,
        notes: 'Excellent work as always'
      }
    ]
  },
  {
    id: 'cust_002',
    name: 'Sarah Johnson',
    email: 'sarah.j@test.local',
    phone: '(555) 102-1002',
    address: '456 Oak Ave, Test City, TC 12346',
    zone: 'Zone B',
    notes: 'Has two large dogs - requires pet-safe products. Dogs are friendly but energetic.',
    created_at: '2024-02-01T00:00:00Z',
    service_history: []
  },
  {
    id: 'cust_003',
    name: 'Mike Wilson',
    email: 'm.wilson@test.local',
    phone: '(555) 103-1003',
    address: '789 Pine Dr, Test City, TC 12347',
    zone: 'Zone A',
    notes: 'Commercial property - after hours access required. Security code: 1234',
    created_at: '2024-02-15T00:00:00Z',
    service_history: [
      {
        date: '2024-02-20',
        service: 'Office carpet cleaning',
        rooms: 8,
        satisfaction: 4,
        notes: 'Good service, minor timing issue'
      }
    ]
  },
  {
    id: 'cust_004',
    name: 'Emily Davis',
    email: 'emily.davis@test.local',
    phone: '(555) 104-1004',
    address: '321 Elm St, Test City, TC 12348',
    zone: 'Zone C',
    notes: 'Elderly customer - needs assistance moving furniture. Very particular about quality.',
    created_at: '2024-03-01T00:00:00Z',
    service_history: [
      {
        date: '2024-03-15',
        service: 'Upholstery cleaning',
        rooms: 2,
        satisfaction: 3,
        notes: 'Some concerns about drying time'
      }
    ]
  },
  {
    id: 'cust_005',
    name: 'Robert Brown',
    email: 'rob.brown@test.local',
    phone: '(555) 105-1005',
    address: '654 Maple Ave, Test City, TC 12349',
    zone: 'Zone B',
    notes: 'New customer - found us through online search. Price-conscious.',
    created_at: '2024-11-01T00:00:00Z',
    service_history: []
  }
]

// Sample Jobs for UAT
export const uatJobs: UATJob[] = [
  {
    id: 'job_001',
    customer_id: 'cust_001',
    customer_name: 'John Smith',
    service_type: 'Carpet cleaning',
    rooms: ['Living room', 'Master bedroom', 'Guest bedroom'],
    scheduled_date: '2024-12-20',
    scheduled_time: '10:00 AM',
    estimated_duration: '2 hours',
    technician: 'Tech 1',
    zone: 'Zone A',
    status: 'scheduled',
    special_instructions: 'Use low-moisture cleaning method. Customer prefers eco-friendly products.',
    internal_notes: 'Regular customer - always tips well. Parking on street only.'
  },
  {
    id: 'job_002',
    customer_id: 'cust_002',
    customer_name: 'Sarah Johnson',
    service_type: 'Carpet and upholstery',
    rooms: ['Living room', 'Dining room'],
    scheduled_date: '2024-12-21',
    scheduled_time: '2:00 PM',
    estimated_duration: '3 hours',
    technician: 'Tech 2',
    zone: 'Zone B',
    status: 'confirmed',
    special_instructions: 'Pet-safe products ONLY - customer has allergies. Two large dogs on premise.',
    internal_notes: 'Dogs are friendly but may be excited. Customer works from home.'
  },
  {
    id: 'job_003',
    customer_id: 'cust_003',
    customer_name: 'Mike Wilson',
    service_type: 'Commercial cleaning',
    rooms: ['Office areas', 'Conference rooms', 'Reception area'],
    scheduled_date: '2024-12-22',
    scheduled_time: '6:00 PM',
    estimated_duration: '4 hours',
    technician: 'Tech 1',
    zone: 'Zone A',
    status: 'on_the_way',
    special_instructions: 'After hours access - security code: 1234. Disable alarm system.',
    internal_notes: 'Large commercial job. Need to coordinate with security.'
  },
  {
    id: 'job_004',
    customer_id: 'cust_004',
    customer_name: 'Emily Davis',
    service_type: 'Deep cleaning',
    rooms: ['Living room', 'Bedroom'],
    scheduled_date: '2024-12-23',
    scheduled_time: '9:00 AM',
    estimated_duration: '3 hours',
    technician: 'Tech 3',
    zone: 'Zone C',
    status: 'scheduled',
    special_instructions: 'Customer needs help moving furniture. Take extra care with antique pieces.',
    internal_notes: 'Customer is particular about quality. Previous issue with drying time.'
  },
  {
    id: 'job_005',
    customer_id: 'cust_005',
    customer_name: 'Robert Brown',
    service_type: 'Basic cleaning',
    rooms: ['Living room', 'Hallway'],
    scheduled_date: '2024-12-24',
    scheduled_time: '11:00 AM',
    estimated_duration: '1.5 hours',
    technician: 'Tech 2',
    zone: 'Zone B',
    status: 'scheduled',
    special_instructions: 'New customer - provide service overview. Budget-conscious.',
    internal_notes: 'First-time customer. Opportunity to build relationship.'
  }
]

// SMS Test Scenarios
export const uatSMSScenarios: UATSMSScenario[] = [
  {
    id: 'sms_001',
    scenario_name: 'Standard Appointment Reminder',
    recipient: '+15551011001',
    message_type: 'appointment_reminder',
    test_conditions: [
      'Message sent 24 hours before appointment',
      'During business hours (8 AM - 9 PM CT)',
      'Customer has not opted out'
    ],
    expected_behavior: 'Message delivered within 5 minutes',
    compliance_requirements: [
      'Include company identification',
      'Include opt-out instructions (Reply STOP)',
      'Professional tone and language',
      'Accurate appointment details'
    ]
  },
  {
    id: 'sms_002',
    scenario_name: 'On the Way Notification',
    recipient: '+15551021002',
    message_type: 'on_the_way',
    test_conditions: [
      'Technician marks job as "On the Way"',
      'GPS location available',
      'ETA calculated'
    ],
    expected_behavior: 'Immediate message delivery with accurate ETA',
    compliance_requirements: [
      'Include technician name',
      'Include estimated arrival time',
      'Provide company contact information'
    ]
  },
  {
    id: 'sms_003',
    scenario_name: 'Quiet Hours Compliance Test',
    recipient: '+15551031003',
    message_type: 'appointment_reminder',
    test_conditions: [
      'Message scheduled for 10:30 PM CT',
      'System detects quiet hours violation'
    ],
    expected_behavior: 'Message delayed until 8:00 AM CT next day',
    compliance_requirements: [
      'No messages sent between 9 PM - 8 AM CT',
      'Delayed messages sent at 8:00 AM sharp',
      'Original message content preserved'
    ]
  },
  {
    id: 'sms_004',
    scenario_name: 'STOP Request Processing',
    recipient: '+15551041004',
    message_type: 'appointment_reminder',
    test_conditions: [
      'Customer replies "STOP" to any message',
      'System processes opt-out request'
    ],
    expected_behavior: 'Immediate opt-out confirmation, no future messages',
    compliance_requirements: [
      'Process STOP within 5 minutes',
      'Send confirmation message',
      'No marketing messages after STOP',
      'Maintain opt-out list integrity'
    ]
  },
  {
    id: 'sms_005',
    scenario_name: 'Survey Link Delivery',
    recipient: '+15551051005',
    message_type: 'job_complete',
    test_conditions: [
      'Job marked as completed',
      'Customer has valid phone number',
      'Survey system operational'
    ],
    expected_behavior: 'Survey link delivered within 15 minutes of completion',
    compliance_requirements: [
      'Unique survey token per job',
      'Token expires after 30 days',
      'Professional thank you message',
      'Clear survey instructions'
    ]
  }
]

// Test Users for UAT
export const uatUsers: UATUser[] = [
  {
    id: 'user_admin',
    email: 'admin.test@acme.test',
    name: 'UAT Administrator',
    role: 'admin',
    phone: '(555) 999-0001',
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'user_dispatcher',
    email: 'dispatch.test@acme.test',
    name: 'UAT Dispatcher',
    role: 'dispatcher',
    phone: '(555) 999-0002',
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'user_tech1',
    email: 'tech1.test@acme.test',
    name: 'UAT Technician 1',
    role: 'technician',
    phone: '(555) 999-0003',
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'user_tech2',
    email: 'tech2.test@acme.test',
    name: 'UAT Technician 2',
    role: 'technician',
    phone: '(555) 999-0004',
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'user_tech3',
    email: 'tech3.test@acme.test',
    name: 'UAT Technician 3',
    role: 'technician',
    phone: '(555) 999-0005',
    created_at: '2024-01-01T00:00:00Z'
  }
]

// Test phone numbers for SMS testing (using valid format but non-working numbers)
export const uatTestPhoneNumbers = {
  valid: [
    '+15551011001', // John Smith
    '+15551021002', // Sarah Johnson
    '+15551031003', // Mike Wilson
    '+15551041004', // Emily Davis
    '+15551051005', // Robert Brown
  ],
  optedOut: [
    '+15551060006', // Previously opted out customer
    '+15551070007'  // Another opted out number
  ],
  invalid: [
    '+1555999999', // Too short
    '+1555123456789', // Too long
    '555-123-4567', // Wrong format
    'not-a-phone-number' // Invalid format
  ]
}

// Helper functions for UAT data management
export class UATDataManager {
  /**
   * Generate a complete UAT dataset
   */
  static generateFullDataset() {
    return {
      customers: uatCustomers,
      jobs: uatJobs,
      users: uatUsers,
      smsScenarios: uatSMSScenarios,
      testPhones: uatTestPhoneNumbers
    }
  }

  /**
   * Get customers by zone
   */
  static getCustomersByZone(zone: string): UATCustomer[] {
    return uatCustomers.filter(customer => customer.zone === zone)
  }

  /**
   * Get jobs by status
   */
  static getJobsByStatus(status: UATJob['status']): UATJob[] {
    return uatJobs.filter(job => job.status === status)
  }

  /**
   * Get jobs for specific technician
   */
  static getJobsForTechnician(technician: string): UATJob[] {
    return uatJobs.filter(job => job.technician === technician)
  }

  /**
   * Get SMS scenarios by type
   */
  static getSMSScenariosByType(messageType: UATSMSScenario['message_type']): UATSMSScenario[] {
    return uatSMSScenarios.filter(scenario => scenario.message_type === messageType)
  }

  /**
   * Generate test job for specific customer
   */
  static generateTestJob(customerId: string, overrides: Partial<UATJob> = {}): UATJob {
    const customer = uatCustomers.find(c => c.id === customerId)
    if (!customer) {
      throw new Error(`Customer ${customerId} not found`)
    }

    const baseJob: UATJob = {
      id: `job_${Date.now()}`,
      customer_id: customerId,
      customer_name: customer.name,
      service_type: 'Carpet cleaning',
      rooms: ['Living room'],
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '10:00 AM',
      estimated_duration: '2 hours',
      technician: 'Tech 1',
      zone: customer.zone,
      status: 'scheduled'
    }

    return { ...baseJob, ...overrides }
  }

  /**
   * Validate UAT data integrity
   */
  static validateDataIntegrity(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check for duplicate customer IDs
    const customerIds = uatCustomers.map(c => c.id)
    const duplicateCustomerIds = customerIds.filter((id, index) => customerIds.indexOf(id) !== index)
    if (duplicateCustomerIds.length > 0) {
      errors.push(`Duplicate customer IDs: ${duplicateCustomerIds.join(', ')}`)
    }

    // Check for duplicate job IDs
    const jobIds = uatJobs.map(j => j.id)
    const duplicateJobIds = jobIds.filter((id, index) => jobIds.indexOf(id) !== index)
    if (duplicateJobIds.length > 0) {
      errors.push(`Duplicate job IDs: ${duplicateJobIds.join(', ')}`)
    }

    // Validate job customer references
    for (const job of uatJobs) {
      const customer = uatCustomers.find(c => c.id === job.customer_id)
      if (!customer) {
        errors.push(`Job ${job.id} references non-existent customer ${job.customer_id}`)
      } else if (customer.name !== job.customer_name) {
        errors.push(`Job ${job.id} customer name mismatch`)
      }
    }

    // Validate phone number formats
    for (const customer of uatCustomers) {
      const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/
      if (!phoneRegex.test(customer.phone)) {
        errors.push(`Customer ${customer.id} has invalid phone format: ${customer.phone}`)
      }
    }

    // Validate email formats
    for (const customer of uatCustomers) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(customer.email)) {
        errors.push(`Customer ${customer.id} has invalid email format: ${customer.email}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Export UAT data as JSON
   */
  static exportAsJSON(): string {
    return JSON.stringify(this.generateFullDataset(), null, 2)
  }

  /**
   * Generate CSV export for customers
   */
  static exportCustomersAsCSV(): string {
    const headers = ['ID', 'Name', 'Email', 'Phone', 'Address', 'Zone', 'Notes', 'Service Count']
    const rows = uatCustomers.map(customer => [
      customer.id,
      customer.name,
      customer.email,
      customer.phone,
      customer.address,
      customer.zone,
      customer.notes || '',
      customer.service_history.length.toString()
    ])

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n')
  }
}