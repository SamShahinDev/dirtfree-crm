import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'

const services = [
  {
    title: 'Carpet Cleaning',
    slug: 'carpet-cleaning',
    image: '/images/services/carpet-cleaning.jpg',
    description: 'Deep clean with truck-powered equipment. 30-minute dry time.',
    price: 'Starting at $35/room',
    popular: true,
  },
  {
    title: 'Tile & Grout Cleaning',
    slug: 'tile-grout-cleaning',
    image: '/images/services/tile-grout.jpg',
    description: 'Restore your tile floors to like-new condition with our deep cleaning.',
    price: 'Starting at $0.75/sq ft',
    popular: false,
  },
  {
    title: 'Upholstery Cleaning',
    slug: 'upholstery-cleaning',
    image: '/images/services/upholstery.jpg',
    description: 'Refresh furniture with safe, effective cleaning methods.',
    price: 'Starting at $75/piece',
    popular: false,
  },
  {
    title: 'Air Duct Cleaning',
    slug: 'air-duct-cleaning',
    image: '/images/services/air-duct.jpg',
    description: 'Improve indoor air quality and HVAC efficiency.',
    price: 'Contact for pricing',
    popular: false,
  },
  {
    title: 'Pet Stain & Odor Removal',
    slug: 'pet-stain-odor-removal',
    image: '/images/services/pet-stain.jpg',
    description: 'Eliminate pet stains and odors with enzyme treatment.',
    price: 'Starting at $50/area',
    popular: true,
  },
  {
    title: 'Water Damage Restoration',
    slug: 'water-damage-restoration',
    image: '/images/services/water-damage.jpg',
    description: '24/7 emergency response for water damage situations.',
    price: 'Emergency call-out',
    popular: false,
  },
]

export function FeaturedServices() {
  return (
    <section className="section-padding bg-neutral-light">
      <div className="section-container">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-primary-navy mb-4">
            Our Professional Cleaning Services
          </h2>
          <p className="text-lg md:text-xl text-neutral-dark">
            Comprehensive solutions for every cleaning need
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {services.map((service) => (
            <Link
              key={service.slug}
              href={`/services/${service.slug}`}
              className="group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
            >
              {/* Image Container */}
              <div className="relative h-64 overflow-hidden">
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                />
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-primary-navy/80 via-primary-navy/40 to-transparent" />

                {/* Popular Badge */}
                {service.popular && (
                  <Badge className="absolute top-4 right-4 bg-accent-orange text-white border-0">
                    Most Popular
                  </Badge>
                )}

                {/* Service Title Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h3 className="text-2xl font-display font-bold text-white mb-2">
                    {service.title}
                  </h3>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-neutral-dark mb-4 line-clamp-2">
                  {service.description}
                </p>

                {/* Price */}
                <p className="text-primary-blue font-semibold mb-4">
                  {service.price}
                </p>

                {/* Learn More Link */}
                <div className="flex items-center text-primary-blue group-hover:text-accent-orange font-medium transition-colors">
                  Learn More
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* View All CTA */}
        <div className="text-center mt-12">
          <Button asChild size="lg" variant="outline" className="border-primary-blue text-primary-blue hover:bg-primary-blue hover:text-white">
            <Link href="/services">
              View All Services
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
