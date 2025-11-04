'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ServiceArea {
  name: string
  slug: string
  avgResponseTime: string
  popular: boolean
}

const serviceAreas: ServiceArea[] = [
  { name: 'Houston', slug: 'houston', avgResponseTime: '45 min', popular: true },
  { name: 'Katy', slug: 'katy', avgResponseTime: '30 min', popular: true },
  { name: 'Sugar Land', slug: 'sugar-land', avgResponseTime: '35 min', popular: true },
  { name: 'Cypress', slug: 'cypress', avgResponseTime: '40 min', popular: true },
  { name: 'Spring', slug: 'spring', avgResponseTime: '50 min', popular: false },
  { name: 'The Woodlands', slug: 'the-woodlands', avgResponseTime: '55 min', popular: false },
  { name: 'Tomball', slug: 'tomball', avgResponseTime: '45 min', popular: false },
  { name: 'Pearland', slug: 'pearland', avgResponseTime: '40 min', popular: false },
  { name: 'Missouri City', slug: 'missouri-city', avgResponseTime: '45 min', popular: false },
  { name: 'Clear Lake', slug: 'clear-lake', avgResponseTime: '50 min', popular: false },
  { name: 'Humble', slug: 'humble', avgResponseTime: '55 min', popular: false },
  { name: 'Kingwood', slug: 'kingwood', avgResponseTime: '60 min', popular: false },
]

export function ServiceAreasSection() {
  const [showAll, setShowAll] = useState(false)

  const displayedAreas = showAll ? serviceAreas : serviceAreas.slice(0, 8)

  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-primary-navy mb-4">
            Proudly Serving Greater Houston
          </h2>
          <p className="text-lg md:text-xl text-neutral-dark">
            From Katy to Kingwood, Pearland to Cypress - we've got you covered
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Left: Map Placeholder */}
          <div className="lg:col-span-2">
            <div className="relative h-96 lg:h-full min-h-[400px] bg-neutral-light rounded-xl overflow-hidden shadow-lg">
              {/* This would be replaced with actual Google Maps integration */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-16 h-16 text-primary-blue mx-auto mb-4" />
                  <p className="text-neutral-dark text-lg">
                    Interactive service area map
                  </p>
                  <p className="text-sm text-neutral-dark mt-2">
                    Click areas to see details
                  </p>
                </div>
              </div>

              {/* Temporary: Static service area indicators */}
              <div className="absolute inset-0 p-8">
                {/* Central Houston marker */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="relative">
                    <div className="w-4 h-4 bg-accent-orange rounded-full animate-pulse" />
                    <div className="absolute inset-0 w-4 h-4 bg-accent-orange rounded-full animate-ping" />
                  </div>
                  <span className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold bg-white px-2 py-1 rounded shadow">
                    Office Location
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Service Areas List */}
          <div>
            <h3 className="text-2xl font-display font-bold text-primary-navy mb-6">
              Primary Service Areas
            </h3>
            <div className="space-y-3">
              {displayedAreas.map((area) => (
                <Link
                  key={area.slug}
                  href={`/service-areas/${area.slug}`}
                  className="block p-4 bg-neutral-light hover:bg-primary-blue/10 rounded-lg transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-primary-blue group-hover:text-accent-orange transition-colors" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-primary-navy group-hover:text-primary-blue transition-colors">
                            {area.name}
                          </span>
                          {area.popular && (
                            <Badge variant="secondary" className="text-xs bg-accent-orange/10 text-accent-orange border-0">
                              Popular
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-neutral-dark mt-1">
                          <Clock className="w-3 h-3" />
                          <span>Avg. {area.avgResponseTime} away</span>
                        </div>
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-neutral-dark group-hover:text-primary-blue group-hover:translate-x-1 transition-all"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>

            {!showAll && serviceAreas.length > 8 && (
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setShowAll(true)}
              >
                Show {serviceAreas.length - 8} More Areas
              </Button>
            )}

            <Button
              asChild
              className="w-full mt-4 bg-primary-blue hover:bg-primary-light"
            >
              <Link href="/service-areas">View All Service Areas</Link>
            </Button>

            {/* ZIP Code Checker Reminder */}
            <div className="mt-8 p-4 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg">
              <p className="text-sm font-semibold text-primary-navy mb-2">
                Don't see your area?
              </p>
              <p className="text-sm text-neutral-dark mb-3">
                Enter your ZIP code to check if we can service your location
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="#service-area-checker">Check Your ZIP Code</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
