'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface Review {
  id: string
  customerName: string
  location: string
  rating: number
  service: string
  text: string
  photo?: string
  date: string
}

const reviews: Review[] = [
  {
    id: '1',
    customerName: 'John D.',
    location: 'Katy, TX',
    rating: 5,
    service: 'Carpet Cleaning',
    text: 'Exceptional service from start to finish. The team arrived on time, explained the process, and my carpets look brand new. The truck-mounted system is incredibly powerful. Dry time was exactly as promised - 45 minutes!',
    photo: '/images/customers/customer-1.jpg',
    date: '2025-03-15',
  },
  {
    id: '2',
    customerName: 'Sarah M.',
    location: 'Sugar Land, TX',
    rating: 5,
    service: 'Pet Stain Removal',
    text: 'I can\'t believe the difference! The pet stains I thought were permanent are completely gone. No odor at all. The technicians were professional and respectful of my home. Highly recommend!',
    photo: '/images/customers/customer-2.jpg',
    date: '2025-03-12',
  },
  {
    id: '3',
    customerName: 'Michael R.',
    location: 'Cypress, TX',
    rating: 5,
    service: 'Tile & Grout Cleaning',
    text: 'Outstanding work! My tile floors look like they did when we first moved in. The grout sealing was a great addition. Fair pricing and excellent customer service. Will definitely use again.',
    photo: '/images/customers/customer-3.jpg',
    date: '2025-03-10',
  },
  // Add more reviews...
]

export function ReviewsSection() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  const visibleReviews = 3
  const maxIndex = Math.max(0, reviews.length - visibleReviews)

  useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1))
    }, 5000)

    return () => clearInterval(interval)
  }, [isAutoPlaying, maxIndex])

  const handlePrevious = () => {
    setIsAutoPlaying(false)
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1))
  }

  const handleNext = () => {
    setIsAutoPlaying(false)
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1))
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-5 h-5 ${
              i < rating ? 'fill-accent-yellow text-accent-yellow' : 'fill-neutral-gray text-neutral-gray'
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-primary-navy mb-6">
            What Houston Homeowners Say
          </h2>

          {/* Rating Summary */}
          <Card className="inline-block p-6 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-5xl font-bold text-primary-navy mb-2">4.5</div>
                <div className="flex justify-center mb-1">
                  {renderStars(5)}
                </div>
                <p className="text-sm text-neutral-dark">Based on 163 Google Reviews</p>
              </div>
              <div className="h-16 w-px bg-neutral-gray" />
              <Button asChild variant="outline" size="lg">
                <a href="/reviews" target="_blank" rel="noopener noreferrer">
                  Write a Review
                </a>
              </Button>
            </div>
          </Card>
        </div>

        {/* Reviews Carousel */}
        <div className="relative">
          {/* Navigation Buttons */}
          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 hidden lg:flex"
            onClick={handlePrevious}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 hidden lg:flex"
            onClick={handleNext}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          {/* Reviews Grid */}
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{
                transform: `translateX(-${currentIndex * (100 / visibleReviews)}%)`,
              }}
            >
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="flex-shrink-0 px-4"
                  style={{ width: `${100 / visibleReviews}%` }}
                >
                  <Card className="bg-primary-blue/5 border-0 p-6 h-full">
                    {/* Customer Info */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative w-16 h-16 rounded-full overflow-hidden bg-neutral-gray">
                        {review.photo ? (
                          <Image
                            src={review.photo}
                            alt={review.customerName}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-primary-blue">
                            {review.customerName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-primary-navy">
                          {review.customerName}
                        </h3>
                        <p className="text-sm text-neutral-dark">{review.location}</p>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="mb-3">{renderStars(review.rating)}</div>

                    {/* Review Text */}
                    <p className="text-neutral-dark mb-4 italic leading-relaxed">
                      "{review.text}"
                    </p>

                    {/* Service Type */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-primary-blue font-medium">
                        Service: {review.service}
                      </span>
                      <span className="text-neutral-dark">
                        {new Date(review.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="flex lg:hidden justify-center gap-4 mt-6">
            <Button variant="outline" size="icon" onClick={handlePrevious}>
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNext}>
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-2 mt-8">
            {[...Array(maxIndex + 1)].map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setIsAutoPlaying(false)
                  setCurrentIndex(index)
                }}
                className={`h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'w-8 bg-primary-blue'
                    : 'w-2 bg-neutral-gray hover:bg-primary-light'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* View All Reviews CTA */}
        <div className="text-center mt-12">
          <Button asChild size="lg" className="bg-primary-blue hover:bg-primary-light">
            <a href="/reviews">View All Reviews</a>
          </Button>
        </div>
      </div>
    </section>
  )
}
