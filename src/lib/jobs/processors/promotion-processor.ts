/**
 * Promotion Email Job Processor
 */

import { createClient } from '@/lib/supabase/server'

export async function sendPromotionEmail(payload: {
  customerId: string
  promotionId: string
}) {
  const supabase = await createClient()

  // Get customer
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', payload.customerId)
    .single()

  if (!customer) {
    throw new Error(`Customer ${payload.customerId} not found`)
  }

  // Get promotion
  const { data: promotion } = await supabase
    .from('promotions')
    .select('*')
    .eq('id', payload.promotionId)
    .single()

  if (!promotion) {
    throw new Error(`Promotion ${payload.promotionId} not found`)
  }

  // Send email (implement with your email service)
  console.log(`Sending promotion email to ${customer.email}`)
  console.log(`Promotion: ${promotion.title}`)

  // TODO: Implement actual email sending
  // await sendEmail({
  //   to: customer.email,
  //   subject: promotion.title,
  //   template: 'promotion',
  //   data: { customer, promotion }
  // })
}
