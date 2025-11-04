import { getServiceSupabase } from '@/lib/supabase/server'

/**
 * Checks if a phone number is opted out from SMS
 *
 * @param e164 - Phone number in E.164 format
 * @returns Promise<boolean> - true if opted out, false otherwise
 */
export async function isOptedOut(e164: string): Promise<boolean> {
  try {
    const supabase = getServiceSupabase()

    const { data } = await supabase
      .from('sms_opt_outs')
      .select('phone_e164')
      .eq('phone_e164', e164)
      .single()

    return !!data
  } catch (error) {
    // Log error but don't include PII
    console.error('Error checking opt-out status:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      hasPhone: !!e164
    })
    return false
  }
}

/**
 * Adds a phone number to the opt-out list
 *
 * @param e164 - Phone number in E.164 format
 * @returns Promise<void>
 */
export async function setOptOut(e164: string): Promise<void> {
  try {
    const supabase = getServiceSupabase()

    // Use upsert to handle duplicate opt-outs gracefully
    const { error } = await supabase
      .from('sms_opt_outs')
      .upsert(
        { phone_e164: e164 },
        { onConflict: 'phone_e164' }
      )

    if (error) {
      throw error
    }
  } catch (error) {
    // Log error but don't include PII
    console.error('Error setting opt-out:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      hasPhone: !!e164
    })
    throw error
  }
}

/**
 * Removes a phone number from the opt-out list (opt back in)
 *
 * @param e164 - Phone number in E.164 format
 * @returns Promise<void>
 */
export async function clearOptOut(e164: string): Promise<void> {
  try {
    const supabase = getServiceSupabase()

    const { error } = await supabase
      .from('sms_opt_outs')
      .delete()
      .eq('phone_e164', e164)

    if (error) {
      throw error
    }
  } catch (error) {
    // Log error but don't include PII
    console.error('Error clearing opt-out:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      hasPhone: !!e164
    })
    throw error
  }
}