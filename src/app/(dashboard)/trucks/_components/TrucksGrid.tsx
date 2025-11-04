'use client'

import { TruckCard } from './TruckCard'
import type { TruckCard as TruckCardType } from '@/types/truck'

interface TrucksGridProps {
  trucks: TruckCardType[]
}

export function TrucksGrid({ trucks }: TrucksGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
      {trucks.map((truck) => (
        <TruckCard key={truck.id} truck={truck} />
      ))}
    </div>
  )
}