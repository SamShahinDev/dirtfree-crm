import { getServiceSupabase } from '@/lib/supabase/server'

export interface ReviewLinks {
  google?: string
  yelp?: string
}

/**
 * Get review links from environment variables or app settings
 * Prioritizes environment variables for simplicity, with fallback to database settings
 */
export async function getReviewLinks(): Promise<ReviewLinks> {
  const links: ReviewLinks = {}

  // First, try to get from environment variables
  if (process.env.NEXT_PUBLIC_REVIEW_GOOGLE_URL) {
    links.google = process.env.NEXT_PUBLIC_REVIEW_GOOGLE_URL
  }

  if (process.env.NEXT_PUBLIC_REVIEW_YELP_URL) {
    links.yelp = process.env.NEXT_PUBLIC_REVIEW_YELP_URL
  }

  // If we have both from env, return early
  if (links.google && links.yelp) {
    return links
  }

  // Otherwise, try to get from database settings (if app_settings table exists)
  try {
    const supabase = getServiceSupabase()

    const { data: settings, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['review_google_url', 'review_yelp_url'])

    if (!error && settings) {
      settings.forEach(setting => {
        if (setting.key === 'review_google_url' && setting.value && !links.google) {
          links.google = setting.value
        }
        if (setting.key === 'review_yelp_url' && setting.value && !links.yelp) {
          links.yelp = setting.value
        }
      })
    }
  } catch (error) {
    // app_settings table might not exist, which is fine
    // We'll just use the environment variables
    console.debug('Could not fetch review links from database, using environment variables only')
  }

  return links
}

/**
 * Validate that a URL is a valid review link
 * Basic validation to ensure URLs are for known review platforms
 */
export function isValidReviewUrl(url: string, platform: 'google' | 'yelp'): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  try {
    const parsedUrl = new URL(url)

    switch (platform) {
      case 'google':
        // Google reviews can be from various domains
        return (
          parsedUrl.hostname.includes('google.com') ||
          parsedUrl.hostname.includes('business.google.com') ||
          parsedUrl.hostname.includes('maps.google.com') ||
          parsedUrl.hostname.includes('goo.gl') ||
          parsedUrl.hostname.includes('g.page')
        )

      case 'yelp':
        // Yelp reviews
        return (
          parsedUrl.hostname.includes('yelp.com') ||
          parsedUrl.hostname.includes('yelp.co')
        )

      default:
        return false
    }
  } catch {
    return false
  }
}

/**
 * Get company information for review context
 * Returns basic company info that can be used in review prompts
 */
export async function getCompanyInfo(): Promise<{
  name: string
  businessType: string
}> {
  // Default company info
  const defaultInfo = {
    name: 'Dirt Free Carpet',
    businessType: 'carpet cleaning service'
  }

  try {
    const supabase = getServiceSupabase()

    const { data: settings, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['company_name', 'business_type'])

    if (!error && settings) {
      const companyInfo = { ...defaultInfo }

      settings.forEach(setting => {
        if (setting.key === 'company_name' && setting.value) {
          companyInfo.name = setting.value
        }
        if (setting.key === 'business_type' && setting.value) {
          companyInfo.businessType = setting.value
        }
      })

      return companyInfo
    }
  } catch (error) {
    // app_settings table might not exist, use defaults
    console.debug('Could not fetch company info from database, using defaults')
  }

  return defaultInfo
}

/**
 * Generate review prompt text based on score and company info
 * Creates contextual messaging for different review scenarios
 */
export async function getReviewPromptText(score: number): Promise<{
  title: string
  message: string
  buttonText: string
}> {
  const companyInfo = await getCompanyInfo()

  if (score >= 4) {
    return {
      title: 'Thank you for your feedback!',
      message: `We're thrilled you had a great experience with ${companyInfo.name}! Would you mind sharing your experience with others by leaving a review?`,
      buttonText: 'Leave a Review'
    }
  } else {
    return {
      title: 'Thank you for your feedback',
      message: `We appreciate you taking the time to share your experience with ${companyInfo.name}. We'll be in touch to make things right.`,
      buttonText: 'Close'
    }
  }
}

/**
 * Server-side function to update review links in database
 * Useful for admin settings management
 */
export async function updateReviewLinks(links: ReviewLinks): Promise<boolean> {
  try {
    const supabase = getServiceSupabase()

    const updates = []

    if (links.google !== undefined) {
      updates.push({
        key: 'review_google_url',
        value: links.google,
        updated_at: new Date().toISOString()
      })
    }

    if (links.yelp !== undefined) {
      updates.push({
        key: 'review_yelp_url',
        value: links.yelp,
        updated_at: new Date().toISOString()
      })
    }

    if (updates.length === 0) {
      return true // Nothing to update
    }

    const { error } = await supabase
      .from('app_settings')
      .upsert(updates, {
        onConflict: 'key'
      })

    if (error) {
      console.error('Error updating review links:', error)
      return false
    }

    return true

  } catch (error) {
    console.error('Error updating review links:', error)
    return false
  }
}