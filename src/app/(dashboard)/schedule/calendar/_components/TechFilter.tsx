'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

import type { TechnicianResource } from '../../actions'

export interface TechFilterProps {
  technicians: TechnicianResource[]
  selectedIds: string[]
  onSelectionChange: (selectedIds: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  maxDisplayed?: number
}

export function TechFilter({
  technicians,
  selectedIds,
  onSelectionChange,
  placeholder = "Select technicians...",
  disabled = false,
  className,
  maxDisplayed = 3
}: TechFilterProps) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Filter technicians based on search term
  const filteredTechnicians = technicians.filter(tech =>
    tech.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (tech.zone && tech.zone.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Get selected technicians for display
  const selectedTechnicians = technicians.filter(tech =>
    selectedIds.includes(tech.id)
  )

  const handleSelect = (technicianId: string) => {
    const newSelection = selectedIds.includes(technicianId)
      ? selectedIds.filter(id => id !== technicianId)
      : [...selectedIds, technicianId]

    onSelectionChange(newSelection)
  }

  const handleSelectAll = () => {
    if (selectedIds.length === technicians.length) {
      // Deselect all
      onSelectionChange([])
    } else {
      // Select all
      onSelectionChange(technicians.map(t => t.id))
    }
  }

  const handleClearAll = () => {
    onSelectionChange([])
  }

  const getDisplayText = () => {
    if (selectedIds.length === 0) {
      return placeholder
    }

    if (selectedIds.length === technicians.length) {
      return "All technicians"
    }

    if (selectedIds.length <= maxDisplayed) {
      return selectedTechnicians
        .map(tech => tech.displayName)
        .join(', ')
    }

    const displayNames = selectedTechnicians
      .slice(0, maxDisplayed)
      .map(tech => tech.displayName)

    return `${displayNames.join(', ')} +${selectedIds.length - maxDisplayed} more`
  }

  const formatTechnicianDisplay = (technician: TechnicianResource) => {
    const parts = [technician.displayName]
    if (technician.zone) {
      parts.push(`(${technician.zone === 'Central' ? 'Central' : `Zone ${technician.zone}`})`)
    }
    return parts.join(' ')
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between min-h-[40px] h-auto"
            disabled={disabled}
          >
            <span className="truncate text-left flex-1">
              {getDisplayText()}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <div className="flex items-center px-3 py-2 border-b">
              <Search className="h-4 w-4 mr-2 opacity-50" />
              <CommandInput
                placeholder="Search technicians..."
                value={searchTerm}
                onValueChange={setSearchTerm}
                className="border-0 p-0 focus:ring-0"
              />
            </div>

            <CommandList className="max-h-[300px]">
              {/* Header with select all/clear actions */}
              <div className="px-3 py-2 border-b bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {selectedIds.length} of {technicians.length} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      className="h-6 px-2 text-xs"
                    >
                      {selectedIds.length === technicians.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    {selectedIds.length > 0 && (
                      <>
                        <Separator orientation="vertical" className="h-4" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearAll}
                          className="h-6 px-2 text-xs"
                        >
                          Clear
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {filteredTechnicians.length === 0 && (
                <CommandEmpty>No technicians found.</CommandEmpty>
              )}

              {filteredTechnicians.length > 0 && (
                <CommandGroup>
                  {filteredTechnicians.map((technician) => (
                    <CommandItem
                      key={technician.id}
                      value={technician.id}
                      onSelect={() => handleSelect(technician.id)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {technician.displayName}
                        </div>
                        {technician.zone && (
                          <div className="text-sm text-muted-foreground">
                            {technician.zone === 'Central' ? 'Central Zone' : `Zone ${technician.zone}`}
                          </div>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "ml-2 h-4 w-4 shrink-0",
                          selectedIds.includes(technician.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected technicians as badges */}
      {selectedIds.length > 0 && selectedIds.length <= 5 && (
        <div className="flex flex-wrap gap-1">
          {selectedTechnicians.map((technician) => (
            <Badge
              key={technician.id}
              variant="secondary"
              className="text-xs"
            >
              {technician.displayName}
              {!disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelect(technician.id)}
                  className="ml-1 h-3 w-3 p-0 hover:bg-transparent"
                  aria-label={`Remove ${technician.displayName}`}
                >
                  <X className="h-2 w-2" />
                </Button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Summary when many selected */}
      {selectedIds.length > 5 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {selectedIds.length} technicians selected
          </Badge>
          {!disabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-6 px-2 text-xs"
            >
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  )
}