import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { sendSMS } from '@/lib/sms/twilio'
import { provisionPortalAccount } from '@/lib/portal/provisioning'
import * as Sentry from '@sentry/nextjs'

// Rate limiting (simple in-memory - use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const limit = rateLimitMap.get(ip)

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 }) // 1 minute window
    return true
  }

  if (limit.count >= 5) { // Max 5 requests per minute
    return false
  }

  limit.count++
  return true
}

// Validation schema
const bookingSchema = z.object({
  customerInfo: z.object({
    firstName: z.string().min(1, 'First name is required').max(50),
    lastName: z.string().min(1, 'Last name is required').max(50),
    email: z.string().email('Valid email is required'),
    phone: z.string().regex(/^\+?1?\d{10}$/, 'Valid phone number is required'),
    address: z.object({
      street: z.string().min(1, 'Street address is required'),
      city: z.string().min(1, 'City is required'),
      state: z.string().length(2, 'State must be 2 characters').toUpperCase(),
      zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Valid ZIP code is required'),
    }),
  }),
  serviceInfo: z.object({
    serviceType: z.enum([
      'carpet_cleaning',
      'tile_grout',
      'upholstery',
      'area_rug',
      'water_damage',
      'pet_treatment',
      'scotchgard',
    ], { errorMap: () => ({ message: 'Invalid service type' }) }),
    roomCount: z.number().int().min(1).max(20).optional(),
    squareFootage: z.number().int().min(100).max(10000).optional(),
    preferredDate: z.string().refine((date) => {
      const parsed = new Date(date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return parsed >= today
    }, 'Preferred date must be today or in the future'),
    preferredTime: z.enum(['morning', 'afternoon', 'evening']),
    urgency: z.enum(['standard', 'same-day', 'next-day']).default('standard'),
  }),
  notes: z.string().max(500).optional(),
  referralSource: z.string().max(100).optional(),
  utmParams: z.object({
    source: z.string().max(100).optional(),
    medium: z.string().max(100).optional(),
    campaign: z.string().max(100).optional(),
    content: z.string().max(100).optional(),
    term: z.string().max(100).optional(),
  }).optional(),
})

type BookingData = z.infer<typeof bookingSchema>

export async function POST(req: NextRequest) {
  const transaction = Sentry.startTransaction({
    name: 'POST /api/public/bookings',
    op: 'http.server',
  })

  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again in a minute.' },
        { status: 429 }
      )
    }

    // Parse and validate request
    const body = await req.json()
    const validated = bookingSchema.parse(body)

    // Create Supabase client (service role for public endpoint)
    const supabase = createClient()

    // Check for existing customer
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('*')
      .or(`email.eq.${validated.customerInfo.email},phone.eq.${validated.customerInfo.phone}`)
      .limit(1)

    let customer = existingCustomers?.[0]

    if (!customer) {
      // Create new customer
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          first_name: validated.customerInfo.firstName,
          last_name: validated.customerInfo.lastName,
          email: validated.customerInfo.email,
          phone: validated.customerInfo.phone,
          address_line1: validated.customerInfo.address.street,
          city: validated.customerInfo.address.city,
          state: validated.customerInfo.address.state,
          postal_code: validated.customerInfo.address.zipCode,
          source: validated.referralSource || 'website',
          utm_source: validated.utmParams?.source,
          utm_medium: validated.utmParams?.medium,
          utm_campaign: validated.utmParams?.campaign,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (customerError) {
        console.error('Customer creation error:', customerError)
        Sentry.captureException(customerError)
        throw new Error('Failed to create customer record')
      }

      customer = newCustomer

      // Provision portal account for new customer (async, don't block)
      provisionPortalAccount(customer.id, {
        sendWelcomeEmail: true,
        autoConfirmEmail: true,
      }).catch((error) => {
        console.error('Portal provisioning error:', error)
        Sentry.captureException(error)
      })

      // Enroll in loyalty program (async)
      supabase
        .from('loyalty_transactions')
        .insert({
          customer_id: customer.id,
          transaction_type: 'signup_bonus',
          points: 50,
          description: 'Welcome bonus for new customer',
        })
        .catch((error) => {
          console.error('Loyalty enrollment error:', error)
          Sentry.captureException(error)
        })
    } else {
      // Update existing customer info if different
      const updates: any = {}
      if (customer.first_name !== validated.customerInfo.firstName) {
        updates.first_name = validated.customerInfo.firstName
      }
      if (customer.last_name !== validated.customerInfo.lastName) {
        updates.last_name = validated.customerInfo.lastName
      }
      if (customer.address_line1 !== validated.customerInfo.address.street) {
        updates.address_line1 = validated.customerInfo.address.street
        updates.city = validated.customerInfo.address.city
        updates.state = validated.customerInfo.address.state
        updates.postal_code = validated.customerInfo.address.zipCode
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('customers')
          .update(updates)
          .eq('id', customer.id)
      }
    }

    // Calculate estimated price (basic estimation)
    let estimatedPrice = 0
    const basePrices: Record<string, number> = {
      carpet_cleaning: 35, // per room
      tile_grout: 50, // per room
      upholstery: 75, // per piece
      area_rug: 125, // per rug
      water_damage: 200, // flat rate minimum
      pet_treatment: 25, // per room addon
      scotchgard: 15, // per room addon
    }

    if (validated.serviceInfo.roomCount) {
      estimatedPrice = (basePrices[validated.serviceInfo.serviceType] || 0) * validated.serviceInfo.roomCount
    } else if (validated.serviceInfo.squareFootage) {
      estimatedPrice = Math.ceil(validated.serviceInfo.squareFootage / 200) * (basePrices[validated.serviceInfo.serviceType] || 0)
    } else {
      estimatedPrice = basePrices[validated.serviceInfo.serviceType] || 0
    }

    // Apply urgency pricing
    if (validated.serviceInfo.urgency === 'same-day') {
      estimatedPrice *= 1.5 // 50% surcharge
    } else if (validated.serviceInfo.urgency === 'next-day') {
      estimatedPrice *= 1.25 // 25% surcharge
    }

    // Create job (appointment)
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        customer_id: customer.id,
        service_type: validated.serviceInfo.serviceType,
        room_count: validated.serviceInfo.roomCount,
        square_footage: validated.serviceInfo.squareFootage,
        preferred_date: validated.serviceInfo.preferredDate,
        preferred_time: validated.serviceInfo.preferredTime,
        urgency: validated.serviceInfo.urgency,
        status: 'pending_confirmation',
        notes: validated.notes,
        estimated_price: Math.round(estimatedPrice),
        booked_via_portal: false,
        booked_via_website: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (jobError) {
      console.error('Job creation error:', jobError)
      Sentry.captureException(jobError)
      throw new Error('Failed to create booking')
    }

    // Create notification for dispatch team
    const priority = validated.serviceInfo.urgency === 'same-day' ? 'high' : 'normal'
    await supabase
      .from('notifications')
      .insert({
        type: 'new_website_booking',
        title: 'New Website Booking',
        message: `${customer.first_name} ${customer.last_name} just booked ${validated.serviceInfo.serviceType} via website. ${validated.serviceInfo.urgency === 'same-day' ? 'SAME-DAY REQUEST!' : ''}`,
        priority,
        metadata: {
          customer_id: customer.id,
          job_id: job.id,
          urgency: validated.serviceInfo.urgency,
        },
        created_at: new Date().toISOString(),
      })

    // Send confirmation email to customer
    const serviceTypeLabels: Record<string, string> = {
      carpet_cleaning: 'Carpet Cleaning',
      tile_grout: 'Tile & Grout Cleaning',
      upholstery: 'Upholstery Cleaning',
      area_rug: 'Area Rug Cleaning',
      water_damage: 'Water Damage Restoration',
      pet_treatment: 'Pet Stain & Odor Treatment',
      scotchgard: 'Scotchgard Protection',
    }

    await sendEmail({
      to: customer.email,
      subject: 'Booking Confirmation - Dirt Free Carpet',
      template: 'booking_received',
      data: {
        customerName: customer.first_name,
        serviceType: serviceTypeLabels[validated.serviceInfo.serviceType] || validated.serviceInfo.serviceType,
        preferredDate: new Date(validated.serviceInfo.preferredDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        preferredTime: validated.serviceInfo.preferredTime,
        roomCount: validated.serviceInfo.roomCount,
        bookingId: job.id,
        estimatedPrice,
        urgency: validated.serviceInfo.urgency,
      },
    }).catch((error) => {
      console.error('Confirmation email error:', error)
      Sentry.captureException(error)
    })

    // Send SMS confirmation (if customer hasn't opted out)
    if (customer.phone && customer.sms_opt_in !== false) {
      const smsMessage = validated.serviceInfo.urgency === 'same-day'
        ? `SAME-DAY BOOKING RECEIVED! Thanks for booking ${serviceTypeLabels[validated.serviceInfo.serviceType]} with Dirt Free! We'll call you ASAP to confirm. Booking ID: ${job.id.slice(0, 8)}. Questions? Call (713) 730-2782`
        : `Thanks for booking ${serviceTypeLabels[validated.serviceInfo.serviceType]} with Dirt Free! We received your request for ${new Date(validated.serviceInfo.preferredDate).toLocaleDateString()}. We'll call you within 2 hours to confirm. Booking ID: ${job.id.slice(0, 8)}. -Dirt Free Team`

      await sendSMS({
        to: customer.phone,
        message: smsMessage,
      }).catch((error) => {
        console.error('SMS confirmation error:', error)
        Sentry.captureException(error)
      })
    }

    // Log analytics/conversion
    await supabase.from('website_conversions').insert({
      customer_id: customer.id,
      job_id: job.id,
      conversion_type: 'booking',
      service_type: validated.serviceInfo.serviceType,
      estimated_value: estimatedPrice,
      utm_source: validated.utmParams?.source,
      utm_medium: validated.utmParams?.medium,
      utm_campaign: validated.utmParams?.campaign,
      utm_content: validated.utmParams?.content,
      utm_term: validated.utmParams?.term,
      referral_source: validated.referralSource,
      created_at: new Date().toISOString(),
    }).catch((error) => {
      console.error('Analytics logging error:', error)
      Sentry.captureException(error)
    })

    // Log to portal activity (for customer portal)
    await supabase.from('portal_activity_logs').insert({
      customer_id: customer.id,
      activity_type: 'booking_created',
      description: `Booked ${serviceTypeLabels[validated.serviceInfo.serviceType]} via website`,
      metadata: {
        job_id: job.id,
        service_type: validated.serviceInfo.serviceType,
        booked_via: 'website',
      },
      created_at: new Date().toISOString(),
    }).catch((error) => {
      console.error('Activity log error:', error)
      Sentry.captureException(error)
    })

    transaction.finish()

    return NextResponse.json({
      success: true,
      bookingId: job.id,
      customerId: customer.id,
      estimatedPrice,
      message: validated.serviceInfo.urgency === 'same-day'
        ? 'Same-day booking received! We\'ll call you ASAP to confirm your appointment.'
        : 'Booking received! We\'ll contact you within 2 hours to confirm your appointment.',
      confirmationNumber: job.id.slice(0, 8).toUpperCase(),
    }, { status: 201 })

  } catch (error) {
    console.error('Booking API error:', error)
    Sentry.captureException(error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid booking data',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to process booking. Please call us at (713) 730-2782.',
    }, { status: 500 })
  } finally {
    transaction.finish()
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_WEBSITE_URL || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  })
}
