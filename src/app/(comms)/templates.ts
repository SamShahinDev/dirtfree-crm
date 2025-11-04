export type TemplateKey =
  | 'job_reminder'
  | 'job_confirmed'
  | 'running_late'
  | 'thanks_review'
  | 'on_the_way'
  | 'bookingConfirm'
  | 'reminder48h'
  | 'reminder24h'
  | 'onTheWay'
  | 'survey24h'
  | 'followup'

export interface TemplateContext {
  customerName?: string
  jobDate?: string        // YYYY-MM-DD
  arrivalWindow?: string  // e.g., '1–3 PM'
  company?: string
}

export const DefaultTemplates: Record<TemplateKey, (ctx: TemplateContext) => string> = {
  job_reminder: (ctx) => {
    const customerName = ctx.customerName || 'valued customer'
    const jobDate = ctx.jobDate ? new Date(ctx.jobDate).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }) : 'tomorrow'
    const timeWindow = ctx.arrivalWindow || 'during your scheduled window'
    const company = ctx.company || 'Dirt Free Carpet'

    return `Hi ${customerName}! This is a reminder that ${company} will be cleaning your carpets ${jobDate} ${timeWindow}. We'll text you when we're on our way. Reply STOP to opt out.`
  },

  job_confirmed: (ctx) => {
    const customerName = ctx.customerName || 'valued customer'
    const jobDate = ctx.jobDate ? new Date(ctx.jobDate).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }) : 'your scheduled date'
    const timeWindow = ctx.arrivalWindow || 'during your scheduled window'
    const company = ctx.company || 'Dirt Free Carpet'

    return `${customerName}, your carpet cleaning is confirmed for ${jobDate} ${timeWindow}. ${company} will contact you before arrival. Reply STOP to opt out.`
  },

  running_late: (ctx) => {
    const customerName = ctx.customerName || 'valued customer'
    const company = ctx.company || 'Dirt Free Carpet'

    return `Hi ${customerName}! ${company} is running about 15-30 minutes behind schedule. We appreciate your patience and will be there soon! Reply STOP to opt out.`
  },

  thanks_review: (ctx) => {
    const customerName = ctx.customerName || 'valued customer'
    const company = ctx.company || 'Dirt Free Carpet'

    return `Thanks ${customerName}! ${company} hopes you love your clean carpets. If you're happy with our service, we'd appreciate a review. Reply STOP to opt out.`
  },

  on_the_way: (ctx) => {
    const customerName = ctx.customerName ? ' ' + ctx.customerName : ''
    const company = ctx.company || 'technician'
    const arrivalWindow = ctx.arrivalWindow || 'soon'

    return `Hi${customerName}! Your ${company} is on the way. ETA ${arrivalWindow}. Reply STOP to opt out.`
  },

  // Plan-named keys with new templates or aliases
  bookingConfirm: (ctx) => {
    const customerName = ctx.customerName ? ' ' + ctx.customerName : ''
    const company = ctx.company || 'technician'
    const jobDate = ctx.jobDate ? new Date(ctx.jobDate).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }) : 'your scheduled date'
    const timeWindow = ctx.arrivalWindow ? `, ${ctx.arrivalWindow}` : ''

    return `Hi${customerName}! Your ${company} visit is booked for ${jobDate}${timeWindow}. Reply STOP to opt out.`
  },

  reminder48h: (ctx) => {
    const company = ctx.company || 'Your technician'
    const jobDate = ctx.jobDate ? new Date(ctx.jobDate).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }) : 'your scheduled date'
    const timeWindow = ctx.arrivalWindow ? `, ${ctx.arrivalWindow}` : ''

    return `Reminder: ${company} is scheduled in ~48 hours (${jobDate}${timeWindow}). Reply STOP to opt out.`
  },

  reminder24h: (ctx) => {
    const jobDate = ctx.jobDate ? new Date(ctx.jobDate).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }) : 'your scheduled date'
    const timeWindow = ctx.arrivalWindow ? `, ${ctx.arrivalWindow}` : ''

    return `Reminder: See you ${jobDate}${timeWindow}. Reply STOP to opt out.`
  },

  onTheWay: (ctx) => {
    // Alias to on_the_way
    return DefaultTemplates.on_the_way(ctx)
  },

  survey24h: (ctx) => {
    const company = ctx.company || 'us'

    return `Thanks for choosing ${company}! How did we do? Reply STOP to opt out.`
  },

  followup: (ctx) => {
    const customerName = ctx.customerName ? `, ${ctx.customerName}` : ''
    const company = ctx.company || 'our team'

    return `Just checking in${customerName}. Any questions after your service with ${company}? Reply STOP to opt out.`
  }
}

// Server-side Templates resolver that merges defaults with overrides
// Import this on the server only - it has database dependencies
export async function getTemplates(): Promise<Record<TemplateKey, (ctx: TemplateContext) => string>> {
  if (typeof window !== 'undefined') {
    throw new Error('getTemplates() can only be used on the server')
  }

  try {
    const { getEffectiveTemplates } = await import('@/lib/comms/templates-store')
    return await getEffectiveTemplates()
  } catch (error) {
    console.error('Failed to load effective templates, falling back to defaults:', error)
    return DefaultTemplates
  }
}

// Legacy export for backward compatibility (client-side usage)
export const Templates = DefaultTemplates