'use client'

import { useRef, useEffect, useState } from 'react'
import Map, { Marker, NavigationControl, ScaleControl, Popup } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { JobPopup } from '../zone-board/JobPopup'

// Suppress MapLibre console warnings
const originalWarn = console.warn
console.warn = (...args) => {
  if (args[0]?.includes?.('No actors found')) {
    return // Suppress this specific warning
  }
  originalWarn(...args)
}

interface Job {
  id: string
  customerName: string
  address: string
  latitude: number
  longitude: number
  zone: string
  scheduledTime: string
  duration: string
  status: string
}

interface ZoneMapProps {
  jobs: Job[]
  selectedJob: Job | null
  onJobSelect: (job: Job) => void
  onEdit?: (job: Job) => void
}

// Houston center coordinates
const HOUSTON_CENTER = {
  latitude: 29.7604,
  longitude: -95.3698
}

const ZONE_COLORS = {
  N: '#3b82f6', // blue
  S: '#10b981', // green
  E: '#f97316', // orange
  W: '#a855f7', // purple
}

// Helper function to get zone color
const getZoneColor = (zone: string) => {
  const colors: Record<string, string> = {
    'N': '#3B82F6', // blue
    'S': '#10B981', // green
    'E': '#F59E0B', // orange
    'W': '#8B5CF6', // purple
    'Central': '#6B7280' // gray
  }
  return colors[zone] || colors['Central']
}

export function ZoneMap({ jobs, selectedJob, onJobSelect, onEdit }: ZoneMapProps) {
  const mapRef = useRef<any>(null)
  const [viewState, setViewState] = useState({
    ...HOUSTON_CENTER,
    zoom: 10
  })
  const [showPopup, setShowPopup] = useState(true)

  // Force map resize after mount
  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current.getMap()
      // Force resize after mount
      setTimeout(() => {
        map.resize()
      }, 100)
    }
  }, [])

  // Fit map to show all jobs
  useEffect(() => {
    if (jobs.length > 0 && mapRef.current) {
      const map = mapRef.current.getMap()

      const bounds = jobs.reduce((bounds, job) => {
        return bounds.extend([job.longitude, job.latitude])
      }, new maplibregl.LngLatBounds(
        [jobs[0].longitude, jobs[0].latitude],
        [jobs[0].longitude, jobs[0].latitude]
      ))

      map.fitBounds(bounds, {
        padding: 50,
        duration: 1000
      })
    }
  }, [jobs])

  // Check container dimensions
  useEffect(() => {
    const container = mapRef.current?.getContainer()
    if (container) {
      const rect = container.getBoundingClientRect()
      console.log('📐 Map container dimensions:', {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left
      })
    }
  }, [jobs])

  // Log map style URL
  console.log('🗺️ Attempting to load map with OpenStreetMap tiles')

  return (
    <div className="relative w-full h-full" style={{ minHeight: '400px' }}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle={{
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors'
            }
          },
          layers: [{
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }]
        }}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          minHeight: '400px'
        }}
        onLoad={() => {
          console.log('✅ Map loaded successfully')
          console.log('✅ Map style loaded:', mapRef.current?.getMap()?.getStyle())
          console.log('✅ Map canvas:', mapRef.current?.getMap()?.getCanvas())
          console.log('✅ Map container:', mapRef.current?.getMap()?.getContainer())
        }}
        onError={(e) => {
          console.error('🗺️ ===== MAP ERROR DETAILS =====')
          console.error('🗺️ Error type:', e.type)
          console.error('🗺️ Error.error object:', e.error)
          console.error('🗺️ Error message:', e.error?.message)
          console.error('🗺️ Error stack:', e.error?.stack)
          console.error('🗺️ Original event:', e.originalEvent)
          console.error('🗺️ Target:', e.target)
          console.error('🗺️ =============================')
        }}
        reuseMaps
      >
        {/* Navigation Controls */}
        <NavigationControl position="top-left" />
        <ScaleControl position="bottom-left" />

        {/* Job Markers */}
        {jobs.map((job) => (
          <Marker
            key={job.id}
            latitude={job.latitude}
            longitude={job.longitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent?.stopPropagation()
              console.log('🗺️ Map marker clicked:', job.customerName)
              onJobSelect(job)
            }}
          >
            <div
              className="relative cursor-pointer transition-all duration-200 hover:scale-110"
              style={{
                filter: selectedJob?.id === job.id ? 'drop-shadow(0 0 8px rgba(0,0,0,0.5))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                pointerEvents: 'auto'
              }}
              onClick={(e) => {
                e.stopPropagation()
                console.log('🗺️ Pin clicked:', job.customerName)
                onJobSelect(job)
              }}
            >
              {/* Outer glow ring for selected state */}
              {selectedJob?.id === job.id && (
                <div
                  className="absolute -inset-2 rounded-full animate-pulse"
                  style={{
                    background: `radial-gradient(circle, ${getZoneColor(job.zone)}40 0%, transparent 70%)`,
                    zIndex: -1
                  }}
                />
              )}

              {/* Main pin body */}
              <div
                className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all"
                style={{
                  backgroundColor: getZoneColor(job.zone),
                  border: '3px solid white',
                  boxShadow: selectedJob?.id === job.id
                    ? '0 4px 12px rgba(0,0,0,0.4)'
                    : '0 2px 6px rgba(0,0,0,0.2)'
                }}
              >
                {/* Inner icon or initial */}
                <span className="text-white font-bold text-sm">
                  {job.zone.charAt(0)}
                </span>

                {/* Bottom pointer triangle */}
                <div
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2"
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: `8px solid ${getZoneColor(job.zone)}`,
                    filter: 'drop-shadow(0 2px 1px rgba(0,0,0,0.2))'
                  }}
                />
              </div>
            </div>
          </Marker>
        ))}

        {/* Job Popup */}
        {selectedJob && showPopup && (
          <Popup
            latitude={selectedJob.latitude}
            longitude={selectedJob.longitude}
            anchor="bottom"
            offset={[0, -40]}
            onClose={() => {
              setShowPopup(false)
              setTimeout(() => {
                onJobSelect(null as any)
                setShowPopup(true)
              }, 100)
            }}
            closeButton={false}
            className="job-popup"
          >
            <JobPopup
              job={selectedJob}
              onClose={() => {
                setShowPopup(false)
                setTimeout(() => {
                  onJobSelect(null as any)
                  setShowPopup(true)
                }, 100)
              }}
              onEdit={onEdit}
            />
          </Popup>
        )}
      </Map>

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 max-w-[200px]">
        <div className="text-xs font-semibold mb-2">Zones</div>
        <div className="space-y-1.5">
          {Object.entries(ZONE_COLORS).map(([zone, color]) => {
            const zoneJobs = jobs.filter(j => j.zone === zone)
            return (
              <div key={zone} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span>Zone {zone}</span>
                </div>
                <span className="text-gray-600">{zoneJobs.length}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
