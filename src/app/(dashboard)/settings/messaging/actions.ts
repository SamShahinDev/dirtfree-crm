'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { getServerSupabase } from '@/lib/supabase/server'
import { makeAction } from '@/lib/actions'
import { requireAdmin } from '@/lib/auth/guards'
import {
  getOverrides,
  setOverride,
  deleteOverride,
  getAllTemplateKeys,
  validateTemplateBody
} from '@/lib/comms/templates-store'
import { DefaultTemplates, type TemplateKey, type TemplateContext } from '@/app/(comms)/templates'

export interface ActionResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

// Schema definitions
const UpdateTemplateSchema = z.object({
  key: z.string().min(1, 'Template key is required'),
  body: z.string().min(1, 'Template body is required').max(320, 'Template body must be 320 characters or less')
})

const ResetTemplateSchema = z.object({
  key: z.string().min(1, 'Template key is required')
})

// Types
export interface TemplateData {
  key: string
  body: string
  isDefault: boolean
  isOverridden: boolean
  defaultBody?: string
  characterCount: number
  lastUpdated?: string
}

export interface TemplateListResponse {
  templates: TemplateData[]
  totalTemplates: number
}

/**
 * Lists all SMS templates with override status
 */
export const listTemplates = makeAction(
  z.object({}),
  async (_, { user, role }): Promise<ActionResponse<TemplateListResponse>> => {
    // Admin only
    await requireAdmin()

    try {
      const overrides = await getOverrides()
      const allKeys = await getAllTemplateKeys()
      const templates: TemplateData[] = []

      for (const key of allKeys) {
        const isOverridden = key in overrides
        const defaultTemplate = DefaultTemplates[key as TemplateKey]

        // Generate default body using sample data
        const sampleContext: TemplateContext = {
          customerName: 'John Smith',
          jobDate: '2024-03-15',
          arrivalWindow: '1-3 PM',
          company: 'Dirt Free Carpet'
        }

        const defaultBody = defaultTemplate ? defaultTemplate(sampleContext) : ''
        const currentBody = isOverridden ? overrides[key] : defaultBody

        // Get last updated timestamp for overrides
        let lastUpdated: string | undefined
        if (isOverridden) {
          const supabase = getServerSupabase()
          const { data } = await supabase
            .from('sms_templates_overrides')
            .select('updated_at')
            .eq('key', key)
            .single()

          lastUpdated = data?.updated_at
        }

        templates.push({
          key,
          body: currentBody,
          isDefault: !isOverridden,
          isOverridden,
          defaultBody,
          characterCount: currentBody.length,
          lastUpdated
        })
      }

      // Sort templates by key
      templates.sort((a, b) => a.key.localeCompare(b.key))

      return {
        ok: true,
        data: {
          templates,
          totalTemplates: templates.length
        }
      }
    } catch (error) {
      console.error('List templates error:', error)
      return { ok: false, error: 'Failed to list templates' }
    }
  },
  { minimumRole: 'admin' }
)

/**
 * Updates an SMS template with validation and audit logging
 */
export const updateTemplate = makeAction(
  UpdateTemplateSchema,
  async (input, { user, role }): Promise<ActionResponse<{ updated: boolean }>> => {
    // Admin only
    await requireAdmin()

    const supabase = getServerSupabase()

    try {
      // Validate template body
      const validation = validateTemplateBody(input.body)
      if (!validation.isValid) {
        return {
          ok: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        }
      }

      // Get current state for audit logging
      const overrides = await getOverrides()
      const previousBody = overrides[input.key] || null

      // Get default template for comparison
      const defaultTemplate = DefaultTemplates[input.key as TemplateKey]
      const sampleContext: TemplateContext = {
        customerName: 'John Smith',
        jobDate: '2024-03-15',
        arrivalWindow: '1-3 PM',
        company: 'Dirt Free Carpet'
      }
      const defaultBody = defaultTemplate ? defaultTemplate(sampleContext) : ''

      // Don't save if it's identical to default
      if (input.body === defaultBody) {
        // If there's an existing override, delete it
        if (previousBody) {
          await deleteOverride(input.key as TemplateKey)

          // Audit the reset
          await supabase
            .from('audit_logs')
            .insert({
              action: 'template_reset',
              entity: 'sms_template',
              entity_id: input.key,
              user_id: user.id,
              meta: {
                before: previousBody,
                after: null,
                reset_to_default: true
              }
            })
        }

        revalidatePath('/settings/messaging')
        return { ok: true, data: { updated: true } }
      }

      // Set the override
      await setOverride(input.key as TemplateKey, input.body)

      // Audit log the change
      await supabase
        .from('audit_logs')
        .insert({
          action: 'template_update',
          entity: 'sms_template',
          entity_id: input.key,
          user_id: user.id,
          meta: {
            before: previousBody,
            after: input.body,
            character_count: input.body.length,
            is_new_override: !previousBody
          }
        })

      revalidatePath('/settings/messaging')

      return { ok: true, data: { updated: true } }
    } catch (error) {
      console.error('Update template error:', error)
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to update template'
      }
    }
  },
  { minimumRole: 'admin' }
)

/**
 * Resets an SMS template to default (removes override)
 */
export const resetTemplate = makeAction(
  ResetTemplateSchema,
  async (input, { user, role }): Promise<ActionResponse<{ reset: boolean }>> => {
    // Admin only
    await requireAdmin()

    const supabase = getServerSupabase()

    try {
      // Get current override for audit logging
      const overrides = await getOverrides()
      const currentOverride = overrides[input.key]

      if (!currentOverride) {
        return { ok: false, error: 'Template is already using default' }
      }

      // Delete the override
      await deleteOverride(input.key as TemplateKey)

      // Audit log the reset
      await supabase
        .from('audit_logs')
        .insert({
          action: 'template_reset',
          entity: 'sms_template',
          entity_id: input.key,
          user_id: user.id,
          meta: {
            before: currentOverride,
            after: null,
            reset_to_default: true
          }
        })

      revalidatePath('/settings/messaging')

      return { ok: true, data: { reset: true } }
    } catch (error) {
      console.error('Reset template error:', error)
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to reset template'
      }
    }
  },
  { minimumRole: 'admin' }
)

/**
 * Previews a template with sample data
 */
export const previewTemplate = makeAction(
  z.object({
    key: z.string().min(1),
    body: z.string().optional(),
    sampleData: z.object({
      customerName: z.string().optional(),
      jobDate: z.string().optional(),
      arrivalWindow: z.string().optional(),
      company: z.string().optional()
    }).optional()
  }),
  async (input, { user, role }): Promise<ActionResponse<{ preview: string }>> => {
    // Admin only
    await requireAdmin()

    try {
      const context: TemplateContext = {
        customerName: input.sampleData?.customerName || 'John Smith',
        jobDate: input.sampleData?.jobDate || '2024-03-15',
        arrivalWindow: input.sampleData?.arrivalWindow || '1-3 PM',
        company: input.sampleData?.company || 'Dirt Free Carpet'
      }

      let preview: string

      if (input.body) {
        // Preview custom body
        let result = input.body

        // Apply simple template variable replacement
        result = result
          .replace(/\{\{customerName\}\}/g, context.customerName || 'valued customer')
          .replace(/\{\{company\}\}/g, context.company || 'Dirt Free Carpet')
          .replace(/\{\{arrivalWindow\}\}/g, context.arrivalWindow || 'during your scheduled window')

        // Handle jobDate formatting
        let jobDate = 'tomorrow'
        if (context.jobDate) {
          try {
            jobDate = new Date(context.jobDate).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })
          } catch {
            jobDate = context.jobDate
          }
        }
        result = result.replace(/\{\{jobDate\}\}/g, jobDate)

        preview = result
      } else {
        // Use default template
        const defaultTemplate = DefaultTemplates[input.key as TemplateKey]
        if (!defaultTemplate) {
          return { ok: false, error: 'Template not found' }
        }
        preview = defaultTemplate(context)
      }

      return { ok: true, data: { preview } }
    } catch (error) {
      console.error('Preview template error:', error)
      return { ok: false, error: 'Failed to generate preview' }
    }
  },
  { minimumRole: 'admin' }
)