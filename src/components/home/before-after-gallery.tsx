'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface BeforeAfter {
  id: string
  service: string
  location: string
  before: string
  after: string
  testimonial: string
  customerName: string
}

const gallery: BeforeAfter[] = [
  {
    id: '1',
    service: 'Carpet Cleaning',
    location: 'Katy',
    before: '/images/gallery/carpet-before-1.jpg',
    after: '/images/gallery/carpet-after-1.jpg',
    testimonial: 'Amazing results! My carpets look brand new. The team was professional and the dry time was exactly as promised.',
    customerName: 'Sarah M.',
  },
  {
    id: '2',
    service: 'Tile & Grout',
    location: 'Sugar Land',
    before: '/images/gallery/tile-before-1.jpg',
    after: '/images/gallery/tile-after-1.jpg',
    testimonial: 'I didn\'t think my tile could ever look this good again. Worth every penny!',
    customerName: 'Michael R.',
  },
  {
    id: '3',
    service: 'Pet Stain Removal',
    location: 'Cypress',
    before: '/images/gallery/pet-before-1.jpg',
    after: '/images/gallery/pet-after-1.jpg',
    testimonial: 'The pet stains and odors are completely gone. I\'m so impressed with the results.',
    customerName: 'Jennifer L.',
  },
  // Add more examples...
]

const filterCategories = ['All', 'Carpet', 'Tile', 'Upholstery', 'Pet Stains']

export function BeforeAfterGallery() {
  const [activeFilter, setActiveFilter] = useState('All')
  const [selectedImage, setSelectedImage] = useState<BeforeAfter | null>(null)

  const filteredGallery = activeFilter === 'All'
    ? gallery
    : gallery.filter(item => item.service.includes(activeFilter.replace(' Stains', '')))

  return (
    <section className="section-padding bg-neutral-light">
      <div className="section-container">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-primary-navy mb-4">
            See The Dirt Free Difference
          </h2>
          <p className="text-lg md:text-xl text-neutral-dark">
            Real results from real Houston homes
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {filterCategories.map((category) => (
            <Button
              key={category}
              variant={activeFilter === category ? 'default' : 'outline'}
              onClick={() => setActiveFilter(category)}
              className={activeFilter === category
                ? 'bg-primary-blue hover:bg-primary-light'
                : 'border-neutral-gray hover:border-primary-blue'
              }
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {filteredGallery.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 group cursor-pointer"
              onClick={() => setSelectedImage(item)}
            >
              {/* Before/After Images */}
              <div className="relative h-64">
                {/* Before Image (Left Half) */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute inset-0 w-1/2">
                    <Image
                      src={item.before}
                      alt={`Before ${item.service} in ${item.location}`}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-red-600 text-white border-0">
                        Before
                      </Badge>
                    </div>
                  </div>

                  {/* After Image (Right Half) */}
                  <div className="absolute inset-0 left-1/2">
                    <Image
                      src={item.after}
                      alt={`After ${item.service} in ${item.location}`}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-accent-green text-white border-0">
                        After
                      </Badge>
                    </div>
                  </div>

                  {/* Divider Line */}
                  <div className="absolute inset-y-0 left-1/2 w-1 bg-white shadow-lg" />

                  {/* Zoom Icon on Hover */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="w-12 h-12 text-white" />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="secondary" className="bg-primary-blue/10 text-primary-blue">
                    {item.service}
                  </Badge>
                  <span className="text-sm text-neutral-dark">{item.location}</span>
                </div>

                <p className="text-neutral-dark italic mb-2 line-clamp-2">
                  "{item.testimonial}"
                </p>

                <p className="text-sm font-semibold text-primary-navy">
                  - {item.customerName}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* View More Button */}
        <div className="text-center mt-12">
          <Button asChild size="lg" className="bg-primary-blue hover:bg-primary-light">
            <a href="/reviews">Show More Results</a>
          </Button>
        </div>
      </div>

      {/* Lightbox Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          {selectedImage && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {selectedImage.service} - {selectedImage.location}
                </DialogTitle>
                <DialogDescription>
                  Customer: {selectedImage.customerName}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Badge className="mb-2 bg-red-600 text-white">Before</Badge>
                  <div className="relative h-96">
                    <Image
                      src={selectedImage.before}
                      alt="Before"
                      fill
                      className="object-cover rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <Badge className="mb-2 bg-accent-green text-white">After</Badge>
                  <div className="relative h-96">
                    <Image
                      src={selectedImage.after}
                      alt="After"
                      fill
                      className="object-cover rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-neutral-light rounded-lg">
                <p className="text-neutral-dark italic">
                  "{selectedImage.testimonial}"
                </p>
                <p className="mt-2 font-semibold text-primary-navy">
                  - {selectedImage.customerName}, {selectedImage.location}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
