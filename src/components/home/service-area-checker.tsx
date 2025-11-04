'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export function ServiceAreaChecker() {
  const [zipCode, setZipCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    inServiceArea: boolean
    message: string
    estimatedTime?: string
    nearbyZips?: string[]
  } | null>(null)

  const handleCheck = async () => {
    if (zipCode.length !== 5) {
      setResult({
        inServiceArea: false,
        message: 'Please enter a valid 5-digit ZIP code',
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/service-area/${zipCode}`)
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        inServiceArea: false,
        message: 'Unable to check service area. Please call us at (713) 730-2782',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5)
    setZipCode(value)
    if (result) setResult(null) // Clear result when user types again
  }

  return (
    <section className="section-padding bg-neutral-light">
      <div className="section-container">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-primary-navy mb-4">
            Serving Greater Houston & Surrounding Areas
          </h2>
          <p className="text-lg text-neutral-dark mb-8">
            From Katy to Kingwood, Pearland to Cypress - we've got you covered
          </p>

          {/* ZIP Code Input */}
          <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
            <label htmlFor="zip-code" className="block text-lg font-semibold text-primary-navy mb-4">
              Enter Your ZIP Code
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                id="zip-code"
                type="text"
                inputMode="numeric"
                placeholder="77493"
                value={zipCode}
                onChange={handleZipChange}
                className="text-lg h-12 text-center sm:text-left"
                maxLength={5}
              />
              <Button
                onClick={handleCheck}
                disabled={loading || zipCode.length !== 5}
                className="bg-accent-orange hover:bg-accent-orange/90 h-12 px-8 text-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Check Availability'
                )}
              </Button>
            </div>

            {/* Result Display */}
            {result && (
              <div className={`mt-6 p-4 rounded-lg ${
                result.inServiceArea
                  ? 'bg-accent-green/10 border border-accent-green/30'
                  : 'bg-amber-50 border border-amber-200'
              }`}>
                <div className="flex items-start gap-3">
                  {result.inServiceArea ? (
                    <CheckCircle2 className="h-6 w-6 text-accent-green flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 text-left">
                    <p className={`font-semibold ${
                      result.inServiceArea ? 'text-accent-green' : 'text-amber-700'
                    }`}>
                      {result.message}
                    </p>
                    {result.estimatedTime && (
                      <p className="mt-2 text-sm text-neutral-dark">
                        Estimated arrival time: {result.estimatedTime}
                      </p>
                    )}
                    {result.nearbyZips && result.nearbyZips.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-neutral-dark mb-1">
                          We serve nearby areas:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {result.nearbyZips.map((zip) => (
                            <button
                              key={zip}
                              onClick={() => setZipCode(zip)}
                              className="text-xs bg-primary-blue text-white px-2 py-1 rounded hover:bg-primary-light transition-colors"
                            >
                              {zip}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {result.inServiceArea && (
                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        <Button asChild size="sm" className="bg-primary-blue hover:bg-primary-light">
                          <a href="/book">Book Appointment →</a>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <a href="/quote">Get Free Quote</a>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="mt-6 text-sm text-neutral-dark">
            Or{' '}
            <a href="/service-areas" className="text-primary-blue hover:text-accent-orange font-medium">
              view our complete service area map
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
