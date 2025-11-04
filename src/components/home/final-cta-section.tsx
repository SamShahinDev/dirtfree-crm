import { Button } from '@/components/ui/button'
import { Phone, FileText, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export function FinalCTASection() {
  return (
    <section className="section-padding bg-primary-navy text-white">
      <div className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          {/* Headline */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-6">
            Ready for Cleaner, Healthier Carpets?
          </h2>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-white/90 mb-10">
            Join 2,350+ happy Houston customers. Book your appointment in 60 seconds.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
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
              variant="outline"
              className="w-full sm:w-auto border-2 border-white text-white hover:bg-white hover:text-primary-navy text-lg h-14 px-8"
            >
              <Link href="tel:7137302782">
                <Phone className="mr-2 h-5 w-5" />
                Call (713) 730-2782
              </Link>
            </Button>
          </div>

          {/* Benefits Checkmarks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent-green flex-shrink-0" />
              <span className="text-white/90">Online Booking 24/7</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent-green flex-shrink-0" />
              <span className="text-white/90">Same-Day Available</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent-green flex-shrink-0" />
              <span className="text-white/90">No Pressure Quotes</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent-green flex-shrink-0" />
              <span className="text-white/90">100% Satisfaction Guarantee</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
