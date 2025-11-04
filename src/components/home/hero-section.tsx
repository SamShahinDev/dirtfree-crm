'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Phone, Calendar, FileText } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative h-[90vh] md:h-[85vh] flex items-center">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/images/hero-bg.jpg)',
          }}
        />
        <div className="absolute inset-0 bg-primary-navy/60" />
      </div>

      {/* Content */}
      <div className="section-container relative z-10">
        <div className="max-w-4xl mx-auto text-center text-white animate-fade-in">
          {/* Main Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 text-balance">
            Houston's Most Trusted Carpet Cleaning Since 1989
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl lg:text-2xl text-white/90 mb-8 md:mb-10 text-balance">
            Truck-Powered Deep Cleaning • 30-Minute Dry Time • 36 Years of Trust
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10 md:mb-12">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto bg-accent-orange hover:bg-accent-orange/90 text-white text-lg h-14 px-8"
            >
              <Link href="/quote">
                <FileText className="mr-2 h-5 w-5" />
                Get Free Quote
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto bg-white hover:bg-white/90 text-primary-navy text-lg h-14 px-8"
            >
              <Link href="/book">
                <Calendar className="mr-2 h-5 w-5" />
                Book Online 24/7
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto border-2 border-white text-white hover:bg-white hover:text-primary-navy text-lg h-14 px-8"
            >
              <Link href="tel:7137302782">
                <Phone className="mr-2 h-5 w-5" />
                (713) 730-2782
              </Link>
            </Button>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 px-4 py-2">
              36 Years in Business
            </Badge>
            <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 px-4 py-2">
              BBB Accredited
            </Badge>
            <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 px-4 py-2">
              Fully Insured
            </Badge>
            <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 px-4 py-2">
              100% Satisfaction Guarantee
            </Badge>
          </div>
        </div>
      </div>

      {/* Scroll Indicator (optional) */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/50 rounded-full p-1">
          <div className="w-1 h-3 bg-white/50 rounded-full mx-auto" />
        </div>
      </div>
    </section>
  )
}
