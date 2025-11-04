export interface ServiceTemplate {
  id: string
  name: string
  description: string
  duration_hours: number
  default_price_cents?: number
  service_items?: Array<{
    name: string
    qty: number
    unitPriceCents: number
  }>
}

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    id: 'standard-3-room',
    name: '3 Room Carpet Cleaning',
    description: 'Carpet cleaning - Standard service',
    duration_hours: 2.5,
    default_price_cents: 9900,
    service_items: [
      { name: 'Carpet Cleaning', qty: 3, unitPriceCents: 3300 }
    ]
  },
  {
    id: 'standard-5-room',
    name: '5 Room Carpet Cleaning',
    description: 'Carpet cleaning - Standard service',
    duration_hours: 3.5,
    default_price_cents: 14900,
    service_items: [
      { name: 'Carpet Cleaning', qty: 5, unitPriceCents: 2980 }
    ]
  },
  {
    id: 'tile-grout-standard',
    name: 'Tile & Grout Cleaning',
    description: 'tile-grout',
    duration_hours: 2,
    default_price_cents: 12900
  },
  {
    id: 'upholstery-couch',
    name: 'Upholstery - Couch',
    description: 'Upholstery cleaning - Standard service',
    duration_hours: 1.5,
    default_price_cents: 8900
  },
  {
    id: 'pet-stain-treatment',
    name: 'Pet Stain Treatment',
    description: 'Pet stain removal',
    duration_hours: 2,
    default_price_cents: 11900
  },
  {
    id: 'air-duct-cleaning',
    name: 'Air Duct Cleaning',
    description: 'Air duct cleaning - Standard service',
    duration_hours: 3,
    default_price_cents: 29900
  }
]
