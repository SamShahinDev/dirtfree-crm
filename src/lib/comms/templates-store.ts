/**
 * Server-only template store for SMS templates with database overrides
 * Handles persistence and merging of default templates with custom overrides
 */

import { getServerSupabase } from '@/lib/supabase/server'
import { DefaultTemplates, type TemplateKey, type TemplateContext } from '@/app/(comms)/templates'

// Server-only guard
if (typeof window !== 'undefined') {
  throw new Error('templates-store must only be used on the server side')
}

export interface TemplateOverride {
  key: TemplateKey
  body: string
  updated_at: string
}

/**
 * Gets all template overrides from the database
 */
export async function getOverrides(): Promise<Record<string, string>> {
  const supabase = getServerSupabase()

  try {
    const { data: overrides, error } = await supabase
      .from('sms_templates_overrides')
      .select('key, body')

    if (error) {
      console.error('Error fetching template overrides:', error)
      return {}
    }

    const overrideMap: Record<string, string> = {}
    for (const override of overrides || []) {
      overrideMap[override.key] = override.body
    }

    return overrideMap
  } catch (error) {
    console.error('Failed to get template overrides:', error)
    return {}
  }
}

/**
 * Sets an override for a specific template key
 */
export async function setOverride(key: TemplateKey, body: string): Promise<void> {
  const supabase = getServerSupabase()

  const { error } = await supabase
    .from('sms_templates_overrides')
    .upsert({
      key,
      body,
      updated_at: new Date().toISOString()
    })

  if (error) {
    throw new Error(`Failed to set template override: ${error.message}`)
  }
}

/**
 * Deletes an override for a specific template key (reverts to default)
 */
export async function deleteOverride(key: TemplateKey): Promise<void> {
  const supabase = getServerSupabase()

  const { error } = await supabase
    .from('sms_templates_overrides')
    .delete()
    .eq('key', key)

  if (error) {
    throw new Error(`Failed to delete template override: ${error.message}`)
  }
}

/**
 * Creates a template function from a raw template string
 * Supports simple variable substitution like {{customerName}}
 */
function createTemplateFunction(templateBody: string): (ctx: TemplateContext) => string {
  return (ctx: TemplateContext) => {
    let result = templateBody

    // Replace template variables
    const customerName = ctx.customerName || 'valued customer'
    const company = ctx.company || 'Dirt Free Carpet'

    let jobDate = 'tomorrow'
    if (ctx.jobDate) {
      try {
        jobDate = new Date(ctx.jobDate).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
      } catch {
        jobDate = ctx.jobDate
      }
    }

    const arrivalWindow = ctx.arrivalWindow || 'during your scheduled window'

    // Simple template variable replacement
    result = result
      .replace(/\{\{customerName\}\}/g, customerName)
      .replace(/\{\{company\}\}/g, company)
      .replace(/\{\{jobDate\}\}/g, jobDate)
      .replace(/\{\{arrivalWindow\}\}/g, arrivalWindow)

    return result
  }
}

/**
 * Gets the effective templates (defaults merged with overrides)
 */
export async function getEffectiveTemplates(): Promise<Record<TemplateKey, (ctx: TemplateContext) => string>> {
  const overrides = await getOverrides()
  const effectiveTemplates: Record<TemplateKey, (ctx: TemplateContext) => string> = { ...DefaultTemplates }

  // Apply overrides
  for (const [key, body] of Object.entries(overrides)) {
    if (key in DefaultTemplates) {
      effectiveTemplates[key as TemplateKey] = createTemplateFunction(body)
    }
  }

  return effectiveTemplates
}

/**
 * Gets all template keys including any custom ones from overrides
 */
export async function getAllTemplateKeys(): Promise<string[]> {
  const overrides = await getOverrides()
  const defaultKeys = Object.keys(DefaultTemplates)
  const overrideKeys = Object.keys(overrides)

  // Combine and deduplicate
  const allKeys = new Set([...defaultKeys, ...overrideKeys])
  return Array.from(allKeys).sort()
}

/**
 * Validates a template body
 */
export function validateTemplateBody(body: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check length
  if (body.length > 320) {
    errors.push('Template must be 320 characters or less')
  }

  // Check for required opt-out text
  if (!body.toLowerCase().includes('reply stop to opt out')) {
    errors.push('Template must include "Reply STOP to opt out"')
  }

  // Check for plain text only (no HTML, markdown, etc.)
  const htmlPattern = /<[^>]*>/
  if (htmlPattern.test(body)) {
    errors.push('Template must be plain text only (no HTML)')
  }

  // Check for potentially problematic characters
  const problematicChars = /[^\x20-\x7E\s]/
  if (problematicChars.test(body)) {
    errors.push('Template contains unsupported characters (use standard ASCII only)')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}