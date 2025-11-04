import { Truck, Clock, Droplets, Award, Shield, CalendarCheck } from 'lucide-react'

const benefits = [
  {
    icon: Truck,
    title: 'Truck-Powered Deep Clean',
    description: 'Diesel-powered equipment 10x stronger than portable units. Reaches deep into carpet fibers bottom to top, removing what others leave behind.',
  },
  {
    icon: Clock,
    title: '30-Minute to 2-Hour Dry Time',
    description: 'Back on your carpets the same day. No 8-hour wait like competitors. Advanced extraction technology gets carpets cleaner and drier faster.',
  },
  {
    icon: Droplets,
    title: 'Chemical-Free Super Water',
    description: 'Safe for kids, pets, and environment. Molecular restructured water technology cleans deep without harsh chemicals or residue.',
  },
  {
    icon: Award,
    title: '36 Years in Houston',
    description: 'Family-owned since 1989. 2,350+ satisfied customers. Local team who knows Houston homes and the unique challenges of Texas climate.',
  },
  {
    icon: Shield,
    title: 'Satisfaction Guaranteed',
    description: 'Not happy? We re-clean free. Licensed, bonded, and insured. Professional IICRC certified technicians you can trust in your home.',
  },
  {
    icon: CalendarCheck,
    title: 'Same-Day Service Available',
    description: 'Book online 24/7 or call for emergency water damage response. Flexible scheduling including evenings to work with your schedule.',
  },
]

export function BenefitsSection() {
  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-primary-navy mb-4">
            Why Houston Trusts Dirt Free Carpet
          </h2>
          <p className="text-lg md:text-xl text-neutral-dark">
            36 years of superior cleaning with our proprietary truck-powered technology
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.title}
              className="bg-white border border-neutral-gray rounded-xl p-6 md:p-8 card-hover group"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-blue/10 text-primary-blue mb-4 group-hover:bg-primary-blue group-hover:text-white transition-colors">
                <benefit.icon className="w-8 h-8" />
              </div>

              {/* Title */}
              <h3 className="text-xl font-display font-bold text-primary-navy mb-3">
                {benefit.title}
              </h3>

              {/* Description */}
              <p className="text-neutral-dark leading-relaxed">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <a
            href="/about"
            className="inline-flex items-center text-primary-blue hover:text-accent-orange font-semibold text-lg transition-colors group"
          >
            Learn About Our Process
            <svg
              className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform"
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
          </a>
        </div>
      </div>
    </section>
  )
}
