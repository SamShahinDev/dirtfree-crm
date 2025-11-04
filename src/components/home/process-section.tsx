import { Calendar, FileText, Sparkles, Home } from 'lucide-react'

const steps = [
  {
    number: 1,
    icon: Calendar,
    title: 'Book Online or Call',
    description: 'Quick & easy scheduling. Choose your preferred date and time, or call us for same-day service.',
    details: ['Online booking 24/7', 'Flexible scheduling', 'Same-day available'],
  },
  {
    number: 2,
    icon: FileText,
    title: 'Free Quote',
    description: 'Transparent, no-pressure pricing. We provide upfront estimates with no hidden fees.',
    details: ['Free in-home quotes', 'No obligation', 'Clear pricing'],
  },
  {
    number: 3,
    icon: Sparkles,
    title: 'Deep Clean & Inspect',
    description: 'Truck-powered equipment technology delivers superior results. We inspect to ensure your satisfaction.',
    details: ['Truck-mounted power', 'Professional technicians', 'Quality inspection'],
  },
  {
    number: 4,
    icon: Home,
    title: 'Enjoy Clean Home',
    description: '30-minute to 2-hour dry time means you can get back on your carpets the same day.',
    details: ['Fast dry time', 'No residue', '100% satisfaction'],
  },
]

export function ProcessSection() {
  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-primary-navy mb-4">
            Simple Process, Exceptional Results
          </h2>
          <p className="text-lg md:text-xl text-neutral-dark">
            From booking to beautiful carpets in 4 easy steps
          </p>
        </div>

        {/* Desktop Timeline */}
        <div className="hidden lg:block relative">
          {/* Connection Line */}
          <div className="absolute top-20 left-0 right-0 h-1 bg-primary-blue/20">
            <div className="h-full bg-primary-blue w-full" />
          </div>

          {/* Steps */}
          <div className="grid grid-cols-4 gap-8 relative">
            {steps.map((step, index) => (
              <div key={step.number} className="text-center">
                {/* Icon Circle */}
                <div className="relative inline-flex items-center justify-center w-40 h-40 rounded-full bg-primary-light/10 border-4 border-primary-blue mb-6 group hover:bg-primary-blue hover:scale-105 transition-all duration-300">
                  <step.icon className="w-16 h-16 text-primary-blue group-hover:text-white transition-colors" />

                  {/* Step Number Badge */}
                  <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-accent-orange text-white font-bold text-lg flex items-center justify-center shadow-lg">
                    {step.number}
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-xl font-display font-bold text-primary-navy mb-3">
                  {step.title}
                </h3>
                <p className="text-neutral-dark mb-4">
                  {step.description}
                </p>

                {/* Details */}
                <ul className="space-y-1">
                  {step.details.map((detail) => (
                    <li key={detail} className="text-sm text-neutral-dark flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-orange mr-2" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile/Tablet Vertical Layout */}
        <div className="lg:hidden space-y-8">
          {steps.map((step, index) => (
            <div key={step.number} className="flex gap-6">
              {/* Left: Icon */}
              <div className="flex-shrink-0">
                <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-light/10 border-4 border-primary-blue">
                  <step.icon className="w-8 h-8 text-primary-blue" />
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-accent-orange text-white font-bold text-sm flex items-center justify-center">
                    {step.number}
                  </div>
                </div>
                {/* Connecting Line (except last) */}
                {index < steps.length - 1 && (
                  <div className="w-1 h-16 bg-primary-blue/20 mx-auto mt-4" />
                )}
              </div>

              {/* Right: Content */}
              <div className="flex-1 pt-2">
                <h3 className="text-xl font-display font-bold text-primary-navy mb-2">
                  {step.title}
                </h3>
                <p className="text-neutral-dark mb-3">
                  {step.description}
                </p>
                <ul className="space-y-1">
                  {step.details.map((detail) => (
                    <li key={detail} className="text-sm text-neutral-dark flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-orange mr-2" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
