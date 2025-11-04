'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

import { Settings } from 'lucide-react'

import type { SampleData } from './MessagingSettings'

export interface SampleDataFormProps {
  sampleData: SampleData
  onSampleDataChange: (data: SampleData) => void
}

export function SampleDataForm({
  sampleData,
  onSampleDataChange
}: SampleDataFormProps) {
  const handleChange = (field: keyof SampleData, value: string) => {
    onSampleDataChange({
      ...sampleData,
      [field]: value
    })
  }

  const getDateOptions = () => {
    const options = []
    const today = new Date()

    // Add today
    options.push({
      value: today.toISOString().split('T')[0],
      label: 'Today'
    })

    // Add next 7 days
    for (let i = 1; i <= 7; i++) {
      const date = new Date()
      date.setDate(today.getDate() + i)
      const value = date.toISOString().split('T')[0]
      const label = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })
      options.push({ value, label })
    }

    return options
  }

  const getTimeWindowOptions = () => [
    '8-10 AM',
    '10-12 PM',
    '12-2 PM',
    '1-3 PM',
    '2-4 PM',
    '3-5 PM',
    '4-6 PM',
    'Morning',
    'Afternoon',
    'Evening'
  ]

  return (
    <Card className="rounded-lg">
      <CardHeader className="p-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Sample Data
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        {/* Customer Name */}
        <div className="space-y-2">
          <Label htmlFor="sample-customer-name" className="text-sm">
            Customer Name
          </Label>
          <Input
            id="sample-customer-name"
            value={sampleData.customerName}
            onChange={(e) => handleChange('customerName', e.target.value)}
            placeholder="John Smith"
            className="text-sm"
          />
        </div>

        {/* Job Date */}
        <div className="space-y-2">
          <Label htmlFor="sample-job-date" className="text-sm">
            Job Date
          </Label>
          <Select
            value={sampleData.jobDate}
            onValueChange={(value) => handleChange('jobDate', value)}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select date..." />
            </SelectTrigger>
            <SelectContent>
              {getDateOptions().map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Arrival Window */}
        <div className="space-y-2">
          <Label htmlFor="sample-arrival-window" className="text-sm">
            Arrival Window
          </Label>
          <Select
            value={sampleData.arrivalWindow}
            onValueChange={(value) => handleChange('arrivalWindow', value)}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Select time window..." />
            </SelectTrigger>
            <SelectContent>
              {getTimeWindowOptions().map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Company */}
        <div className="space-y-2">
          <Label htmlFor="sample-company" className="text-sm">
            Company Name
          </Label>
          <Input
            id="sample-company"
            value={sampleData.company}
            onChange={(e) => handleChange('company', e.target.value)}
            placeholder="Dirt Free Carpet"
            className="text-sm"
          />
        </div>

        {/* Preview Variables */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">Variables in preview:</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <code className="bg-muted px-1 rounded">{'{{customerName}}'}</code>
              <span className="text-muted-foreground">→ {sampleData.customerName}</span>
            </div>
            <div className="flex justify-between">
              <code className="bg-muted px-1 rounded">{'{{jobDate}}'}</code>
              <span className="text-muted-foreground">
                → {new Date(sampleData.jobDate).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <code className="bg-muted px-1 rounded">{'{{arrivalWindow}}'}</code>
              <span className="text-muted-foreground">→ {sampleData.arrivalWindow}</span>
            </div>
            <div className="flex justify-between">
              <code className="bg-muted px-1 rounded">{'{{company}}'}</code>
              <span className="text-muted-foreground">→ {sampleData.company}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}