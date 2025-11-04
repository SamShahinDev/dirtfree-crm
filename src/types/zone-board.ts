export interface ZoneBoardJob {
  id: string
  customerId: string
  customerName: string
  address: string
  city: string
  latitude: number
  longitude: number
  zone: string
  scheduledDate: string
  scheduledTime: string
  scheduledTimeEnd?: string
  duration: string
  status: string
  description?: string
  technicianId?: string | null
  invoiceUrl?: string | null
}

export interface TimeSlot {
  id: string
  label: string
  icon: string
  startTime: string
  endTime: string
}

export const TIME_SLOTS: TimeSlot[] = [
  {
    id: 'morning',
    label: 'Morning',
    icon: '🌅',
    startTime: '08:00',
    endTime: '12:00'
  },
  {
    id: 'afternoon',
    label: 'Afternoon',
    icon: '☀️',
    startTime: '12:00',
    endTime: '17:00'
  },
  {
    id: 'evening',
    label: 'Evening',
    icon: '🌙',
    startTime: '17:00',
    endTime: '20:00'
  }
]
