'use client'

import { useState, useEffect } from 'react'
import { MapPin, User, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Technician {
  id: string
  name: string
  zone: string | null
}

interface ZoneTechFiltersProps {
  zones: string[]
  technicians?: Technician[]
  selectedZones: string[]
  selectedTechnician?: string
  onZonesChange: (zones: string[]) => void
  onTechnicianChange?: (technicianId: string | undefined) => void
  showTechnicianFilter?: boolean
  className?: string
  userRole?: 'admin' | 'dispatcher' | 'technician'
}

export function ZoneTechFilters({
  zones,
  technicians = [],
  selectedZones,
  selectedTechnician,
  onZonesChange,
  onTechnicianChange,
  showTechnicianFilter = false,
  className = '',
  userRole = 'admin'
}: ZoneTechFiltersProps) {
  const [localSelectedZones, setLocalSelectedZones] = useState<string[]>(selectedZones)

  // Update local state when props change
  useEffect(() => {
    setLocalSelectedZones(selectedZones)
  }, [selectedZones])

  // Handle zone selection
  const handleZoneToggle = (zone: string, checked: boolean) => {
    const newZones = checked
      ? [...localSelectedZones, zone]
      : localSelectedZones.filter(z => z !== zone)

    setLocalSelectedZones(newZones)
    onZonesChange(newZones)
  }

  // Handle technician selection
  const handleTechnicianChange = (technicianId: string) => {
    const newValue = technicianId === 'all' ? undefined : technicianId
    onTechnicianChange?.(newValue)
  }

  // Reset filters
  const handleReset = () => {
    setLocalSelectedZones([])
    onZonesChange([])
    onTechnicianChange?.(undefined)
  }

  // Filter technicians by selected zones
  const filteredTechnicians = technicians.filter(tech =>
    localSelectedZones.length === 0 ||
    (tech.zone && localSelectedZones.includes(tech.zone))
  )

  const hasActiveFilters = localSelectedZones.length > 0 || selectedTechnician

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Filters
          </div>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs">
              {localSelectedZones.length + (selectedTechnician ? 1 : 0)} active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Zone Filter */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-gray-700">Service Zones</Label>
          {zones.length === 0 ? (
            <p className="text-xs text-gray-500">No zones available</p>
          ) : (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {zones.map((zone) => (
                <div key={zone} className="flex items-center space-x-2">
                  <Checkbox
                    id={`zone-${zone}`}
                    checked={localSelectedZones.includes(zone)}
                    onCheckedChange={(checked) => handleZoneToggle(zone, !!checked)}
                  />
                  <Label
                    htmlFor={`zone-${zone}`}
                    className="text-xs font-normal cursor-pointer flex-1"
                  >
                    Zone {zone}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Technician Filter - Only show for admin/dispatcher */}
        {showTechnicianFilter && userRole !== 'technician' && (
          <div className="space-y-3">
            <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <User className="w-3 h-3" />
              Technician
            </Label>
            <Select
              value={selectedTechnician || 'all'}
              onValueChange={handleTechnicianChange}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="All technicians" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Technicians</SelectItem>
                {filteredTechnicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{tech.name}</span>
                      {tech.zone && (
                        <span className="text-xs text-gray-500 ml-2">
                          Zone {tech.zone}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTechnician && filteredTechnicians.length === 0 && (
              <p className="text-xs text-amber-600">
                Selected technician not found in current zone filter
              </p>
            )}
          </div>
        )}

        {/* Selected Filters Summary */}
        {localSelectedZones.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700">Selected Zones</Label>
            <div className="flex flex-wrap gap-1">
              {localSelectedZones.map((zone) => (
                <Badge
                  key={zone}
                  variant="secondary"
                  className="text-xs px-2 py-1"
                >
                  Zone {zone}
                  <button
                    onClick={() => handleZoneToggle(zone, false)}
                    className="ml-1 hover:text-red-600"
                    aria-label={`Remove zone ${zone}`}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Reset Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="w-full text-xs h-8"
          >
            <RotateCcw className="w-3 h-3 mr-2" />
            Clear Filters
          </Button>
        )}

        {/* Filter Help Text */}
        {userRole === 'technician' && (
          <p className="text-xs text-gray-500 italic">
            You can only view data for your assigned zone and jobs.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// Service type filter for jobs by status report
interface ServiceTypeFilterProps {
  serviceTypes: string[]
  selectedTypes: string[]
  onTypesChange: (types: string[]) => void
  className?: string
}

export function ServiceTypeFilter({
  serviceTypes,
  selectedTypes,
  onTypesChange,
  className = ''
}: ServiceTypeFilterProps) {
  const handleTypeToggle = (type: string, checked: boolean) => {
    const newTypes = checked
      ? [...selectedTypes, type]
      : selectedTypes.filter(t => t !== type)

    onTypesChange(newTypes)
  }

  const handleReset = () => {
    onTypesChange([])
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          Service Types
          {selectedTypes.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selectedTypes.length} selected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {serviceTypes.length === 0 ? (
          <p className="text-xs text-gray-500">No service types available</p>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {serviceTypes.map((type) => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`service-${type}`}
                  checked={selectedTypes.includes(type)}
                  onCheckedChange={(checked) => handleTypeToggle(type, !!checked)}
                />
                <Label
                  htmlFor={`service-${type}`}
                  className="text-xs font-normal cursor-pointer flex-1 capitalize"
                >
                  {type}
                </Label>
              </div>
            ))}
          </div>
        )}

        {selectedTypes.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="w-full text-xs h-8"
          >
            <RotateCcw className="w-3 h-3 mr-2" />
            Clear Selection
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// Horizon picker for upcoming reminders
interface HorizonFilterProps {
  value: number
  onChange: (days: number) => void
  className?: string
}

export function HorizonFilter({
  value,
  onChange,
  className = ''
}: HorizonFilterProps) {
  const options = [
    { value: 7, label: 'Next 7 days' },
    { value: 30, label: 'Next 30 days' },
    { value: 90, label: 'Next 90 days' }
  ]

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Time Horizon</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {options.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <input
                type="radio"
                id={`horizon-${option.value}`}
                name="horizon"
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="text-blue-600"
              />
              <Label
                htmlFor={`horizon-${option.value}`}
                className="text-xs font-normal cursor-pointer flex-1"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}