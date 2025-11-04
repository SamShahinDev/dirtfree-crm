// Analytics Tracking Endpoint
// Receives analytics events from the website and stores them in the database

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsEvent {
  eventType: string;
  pagePath?: string;
  referrer?: string;
  sessionId: string;
  visitorId: string;
  metadata?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    customerId?: string;
    bookingId?: string;
    [key: string]: any;
  };
}

// ============================================================================
// POST /api/public/analytics/track
// Track analytics event from website
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const data: AnalyticsEvent = await req.json();

    const {
      eventType,
      pagePath,
      referrer,
      sessionId,
      visitorId,
      metadata = {},
    } = data;

    // Validate required fields
    if (!eventType || !sessionId || !visitorId) {
      return NextResponse.json(
        { error: 'Missing required fields: eventType, sessionId, visitorId' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // ========================================================================
    // Store Analytics Event
    // ========================================================================

    const { error: eventError } = await supabase.from('website_analytics').insert({
      event_type: eventType,
      page_path: pagePath,
      referrer,
      session_id: sessionId,
      visitor_id: visitorId,
      utm_source: metadata.utm_source,
      utm_medium: metadata.utm_medium,
      utm_campaign: metadata.utm_campaign,
      utm_content: metadata.utm_content,
      utm_term: metadata.utm_term,
      customer_id: metadata.customerId || null,
      job_id: metadata.bookingId || null,
      metadata,
      created_at: new Date().toISOString(),
    });

    if (eventError) {
      console.error('Error storing analytics event:', eventError);
      return NextResponse.json(
        { error: 'Failed to store analytics event' },
        { status: 500 }
      );
    }

    // ========================================================================
    // Update or Create Session
    // ========================================================================

    // Check if session exists
    const { data: existingSession } = await supabase
      .from('website_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (existingSession) {
      // Update existing session
      const duration = Math.floor(
        (new Date().getTime() - new Date(existingSession.started_at).getTime()) / 1000
      );

      const { error: updateError } = await supabase
        .from('website_sessions')
        .update({
          last_page: pagePath,
          pages_visited: existingSession.pages_visited + 1,
          duration_seconds: duration,
          ended_at: new Date().toISOString(),
          // Mark as converted if booking completed
          converted: eventType === 'booking_completed' ? true : existingSession.converted,
          conversion_type:
            eventType === 'booking_completed' ? 'booking' : existingSession.conversion_type,
          // Link to customer/job if available
          customer_id: metadata.customerId || existingSession.customer_id,
          job_id: metadata.bookingId || existingSession.job_id,
        })
        .eq('session_id', sessionId);

      if (updateError) {
        console.error('Error updating session:', updateError);
      }
    } else {
      // Create new session
      const { error: createError } = await supabase.from('website_sessions').insert({
        session_id: sessionId,
        visitor_id: visitorId,
        first_page: pagePath,
        last_page: pagePath,
        pages_visited: 1,
        duration_seconds: 0,
        converted: eventType === 'booking_completed',
        conversion_type: eventType === 'booking_completed' ? 'booking' : null,
        customer_id: metadata.customerId || null,
        job_id: metadata.bookingId || null,
        utm_source: metadata.utm_source,
        utm_medium: metadata.utm_medium,
        utm_campaign: metadata.utm_campaign,
        referrer,
        device_type: getDeviceType(req.headers.get('user-agent')),
        browser: getBrowser(req.headers.get('user-agent')),
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
      });

      if (createError) {
        console.error('Error creating session:', createError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Event tracked successfully',
    });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect device type from user agent
 */
function getDeviceType(userAgent: string | null): string {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }

  if (
    /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
      userAgent
    )
  ) {
    return 'mobile';
  }

  return 'desktop';
}

/**
 * Detect browser from user agent
 */
function getBrowser(userAgent: string | null): string {
  if (!userAgent) return 'unknown';

  const ua = userAgent.toLowerCase();

  if (ua.includes('edg')) return 'edge';
  if (ua.includes('chrome') || ua.includes('crios')) return 'chrome';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
  if (ua.includes('firefox') || ua.includes('fxios')) return 'firefox';
  if (ua.includes('opera') || ua.includes('opr')) return 'opera';
  if (ua.includes('msie') || ua.includes('trident')) return 'ie';

  return 'other';
}

// ============================================================================
// OPTIONS handler for CORS preflight
// ============================================================================

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
