import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { zipcode: string } }
) {
  const zipCode = params.zipcode

  // Validate ZIP code format
  if (!/^\d{5}$/.test(zipCode)) {
    return NextResponse.json(
      {
        inServiceArea: false,
        message: 'Please enter a valid 5-digit ZIP code',
      },
      { status: 400 }
    )
  }

  try {
    const supabase = createServerClient()

    // Query zones table to check if ZIP code is in service area
    const { data: zones, error } = await supabase
      .from('zones')
      .select('*')
      .contains('zip_codes', [zipCode])
      .eq('is_active', true)

    if (error) throw error

    if (zones && zones.length > 0) {
      const zone = zones[0]
      return NextResponse.json({
        inServiceArea: true,
        message: `Great news! We serve your area in ${zone.name}.`,
        estimatedTime: `${zone.avg_response_time} minutes`,
      })
    } else {
      // Find nearby ZIP codes if not in service area
      const { data: allZones } = await supabase
        .from('zones')
        .select('zip_codes')
        .eq('is_active', true)

      // Get all service area ZIP codes
      const allServiceZips = allZones?.flatMap(z => z.zip_codes) || []

      // Find nearby ZIPs (very simplified - in production use proper geo distance calculation)
      const nearbyZips = allServiceZips
        .filter(zip => Math.abs(parseInt(zip) - parseInt(zipCode)) < 50)
        .slice(0, 3)

      return NextResponse.json({
        inServiceArea: false,
        message: `We don't currently serve ${zipCode}, but check nearby areas:`,
        nearbyZips: nearbyZips.length > 0 ? nearbyZips : undefined,
      })
    }
  } catch (error) {
    console.error('Service area check error:', error)
    return NextResponse.json(
      {
        inServiceArea: false,
        message: 'Unable to check service area. Please call us at (713) 730-2782',
      },
      { status: 500 }
    )
  }
}
