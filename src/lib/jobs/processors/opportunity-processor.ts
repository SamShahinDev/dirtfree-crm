/**
 * Opportunity Offer Job Processor
 */

import { createClient } from '@/lib/supabase/server'
import { batchProcess } from '../job-queue'

export async function processOpportunityOffer(payload: {
  opportunityId: string
}) {
  const supabase = await createClient()

  // Get opportunity
  const { data: opportunity } = await supabase
    .from('opportunities')
    .select('*, customers(*)')
    .eq('id', payload.opportunityId)
    .single()

  if (!opportunity) {
    throw new Error(`Opportunity ${payload.opportunityId} not found`)
  }

  // Process based on opportunity status
  switch (opportunity.status) {
    case 'new':
      await processNewOpportunity(opportunity)
      break
    case 'qualified':
      await processQualifiedOpportunity(opportunity)
      break
    case 'proposal':
      await processProposalOpportunity(opportunity)
      break
    default:
      console.log(`No processing needed for status: ${opportunity.status}`)
  }
}

async function processNewOpportunity(opportunity: any) {
  // Auto-qualify based on criteria
  const shouldQualify = opportunity.estimated_value > 1000

  if (shouldQualify) {
    const supabase = await createClient()
    await supabase
      .from('opportunities')
      .update({ status: 'qualified' })
      .eq('id', opportunity.id)

    console.log(`Auto-qualified opportunity ${opportunity.id}`)
  }
}

async function processQualifiedOpportunity(opportunity: any) {
  // Send proposal email
  console.log(`Sending proposal for opportunity ${opportunity.id}`)
  // TODO: Implement proposal email
}

async function processProposalOpportunity(opportunity: any) {
  // Follow up on proposal
  console.log(`Following up on proposal ${opportunity.id}`)
  // TODO: Implement follow-up email
}

/**
 * Batch process multiple opportunities
 */
export async function batchProcessOpportunities(payload: {
  opportunityIds: string[]
}) {
  await batchProcess(
    payload.opportunityIds,
    async (id) => {
      await processOpportunityOffer({ opportunityId: id })
    },
    25 // Process 25 at a time
  )
}
