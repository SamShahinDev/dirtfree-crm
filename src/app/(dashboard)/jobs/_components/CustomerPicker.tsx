'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

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

import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { formatForDisplay } from '@/lib/utils/phone'
import { searchCustomers } from '../actions'

interface Customer {
  id: string
  name: string
  phone_e164?: string | null
  email?: string | null
  city?: string | null
  state?: string | null
  last_service_date?: string | null
  total_jobs_count?: number
  unpaid_amount_cents?: number
  has_unpaid_invoices?: boolean
}

interface CustomerPickerProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  initialCustomerName?: string
}

export function CustomerPicker({
  value,
  onValueChange,
  placeholder = "Select customer...",
  disabled = false,
  className,
  initialCustomerName
}: CustomerPickerProps) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300)

  // Set initial customer when value and initialCustomerName are provided
  useEffect(() => {
    if (value && initialCustomerName && !selectedCustomer) {
      console.log('🎯 Setting initial customer:', { value, initialCustomerName })
      setSelectedCustomer({
        id: value,
        name: initialCustomerName,
        phone_e164: null,
        email: null,
        city: null,
        state: null
      })
    }
  }, [value, initialCustomerName, selectedCustomer])

  // Search customers when search term changes
  useEffect(() => {
    if (debouncedSearchTerm.trim().length === 0) {
      setCustomers([])
      return
    }

    const search = async () => {
      setLoading(true)
      try {
        console.log('🔍 Searching for:', debouncedSearchTerm)
        const response = await searchCustomers({
          q: debouncedSearchTerm,
          limit: 10
        })

        console.log('📦 Search response:', response)

        if (response.success) {
          console.log('✅ Found customers:', response.data)
          setCustomers(response.data)
        } else {
          console.error('❌ Search failed:', response.error)
          setCustomers([])
        }
      } catch (error) {
        console.error('Failed to search customers:', error)
        setCustomers([])
      } finally {
        setLoading(false)
      }
    }

    search()
  }, [debouncedSearchTerm])

  const handleSelect = (customer: Customer) => {
    console.log('✅ Customer selected:', customer)
    setSelectedCustomer(customer)
    onValueChange(customer.id)
    setOpen(false)
    setSearchTerm('')
  }

  const formatCustomerDisplay = (customer: Customer) => {
    const parts = []

    if (customer.phone_e164) {
      parts.push(formatForDisplay(customer.phone_e164))
    }

    if (customer.city && customer.state) {
      parts.push(`${customer.city}, ${customer.state}`)
    }

    if (customer.total_jobs_count) {
      parts.push(`${customer.total_jobs_count} job${customer.total_jobs_count === 1 ? '' : 's'}`)
    }

    if (customer.last_service_date) {
      const lastService = new Date(customer.last_service_date)
      const daysAgo = Math.floor((Date.now() - lastService.getTime()) / (1000 * 60 * 60 * 24))
      if (daysAgo < 90) {
        parts.push(`Last service ${daysAgo}d ago`)
      }
    }

    return parts.join(' • ')
  }

  const getDisplayValue = () => {
    if (selectedCustomer) {
      return selectedCustomer.name
    }
    return placeholder
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
          disabled={disabled}
        >
          <span className="truncate">{getDisplayValue()}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search customers by name, phone, or city..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {loading && (
              <CommandEmpty>Searching customers...</CommandEmpty>
            )}
            {!loading && searchTerm.trim().length === 0 && (
              <CommandEmpty>Start typing to search customers</CommandEmpty>
            )}
            {!loading && searchTerm.trim().length > 0 && customers.length === 0 && (
              <CommandEmpty>No customers found</CommandEmpty>
            )}
            {customers.length > 0 && (
              <CommandGroup>
                {customers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => handleSelect(customer)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{customer.name}</span>
                        {customer.has_unpaid_invoices && (
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                            Unpaid
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {formatCustomerDisplay(customer)}
                      </div>
                      {customer.unpaid_amount_cents && customer.unpaid_amount_cents > 0 && (
                        <div className="text-xs text-amber-600 mt-1">
                          ${(customer.unpaid_amount_cents / 100).toFixed(2)} outstanding
                        </div>
                      )}
                    </div>
                    <Check
                      className={cn(
                        "ml-2 h-4 w-4",
                        value === customer.id ? "opacity-100" : "opacity-0"
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
  )
}