import Image from 'next/image'
import { Award, Shield, Users, Heart } from 'lucide-react'

const credentials = [
  {
    icon: Award,
    title: '36 Years',
    subtitle: 'In Business',
    description: 'Family-owned and operated since 1989. Three decades of trusted service in Houston.',
    badge: '/images/badges/36-years.png',
  },
  {
    icon: Shield,
    title: 'BBB',
    subtitle: 'B+ Rating',
    description: 'Better Business Bureau accredited with excellent standing and customer satisfaction.',
    badge: '/images/badges/bbb-logo.png',
  },
  {
    icon: Shield,
    title: 'Insured',
    subtitle: '& Bonded',
    description: 'Fully licensed, insured, and bonded for your protection and peace of mind.',
    badge: '/images/badges/insured.png',
  },
  {
    icon: Award,
    title: 'IICRC',
    subtitle: 'Certified',
    description: 'Professional certifications from the Institute of Inspection, Cleaning and Restoration.',
    badge: '/images/badges/iicrc.png',
  },
  {
    icon: Heart,
    title: 'Family',
    subtitle: 'Owned',
    description: 'Local family business dedicated to serving our Houston community with care.',
    badge: '/images/badges/family-owned.png',
  },
  {
    icon: Users,
    title: '100%',
    subtitle: 'Satisfaction',
    description: 'Your satisfaction is guaranteed. Not happy? We\'ll re-clean at no charge.',
    badge: '/images/badges/satisfaction.png',
  },
]

export function TrustSection() {
  return (
    <section className="section-padding bg-primary-navy text-white">
      <div className="section-container">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4">
            Licensed, Certified, and Trusted
          </h2>
          <p className="text-lg md:text-xl text-white/80">
            Your peace of mind is our priority
          </p>
        </div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {credentials.map((credential, index) => (
            <div
              key={credential.title}
              className="text-center group"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Badge/Icon Container */}
              <div className="relative inline-flex items-center justify-center w-32 h-32 mb-6">
                {/* Background Circle */}
                <div className="absolute inset-0 bg-white/10 rounded-full group-hover:bg-white/20 transition-colors" />

                {/* Icon or Badge Image */}
                {credential.badge ? (
                  <div className="relative w-20 h-20">
                    <Image
                      src={credential.badge}
                      alt={credential.title}
                      fill
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <credential.icon className="w-16 h-16 text-accent-orange" />
                )}
              </div>

              {/* Title */}
              <div className="mb-3">
                <div className="text-3xl font-bold text-accent-orange">
                  {credential.title}
                </div>
                <div className="text-lg font-semibold text-white/90">
                  {credential.subtitle}
                </div>
              </div>

              {/* Description */}
              <p className="text-white/70 leading-relaxed max-w-xs mx-auto">
                {credential.description}
              </p>
            </div>
          ))}
        </div>

        {/* Additional Trust Indicators */}
        <div className="mt-16 pt-12 border-t border-white/20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-accent-orange mb-2">2,350+</div>
              <div className="text-white/80">Happy Customers</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-accent-orange mb-2">36</div>
              <div className="text-white/80">Years Experience</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-accent-orange mb-2">4.5/5</div>
              <div className="text-white/80">Average Rating</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-accent-orange mb-2">100%</div>
              <div className="text-white/80">Satisfaction Guarantee</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
