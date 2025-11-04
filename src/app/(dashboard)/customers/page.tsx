'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import PageShell from "@/components/shell/PageShell"
import { PageHeader } from "@/components/ui/PageHeader"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardDescription,
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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
  Download,
  Upload
} from 'lucide-react'

import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { formatForDisplay } from '@/lib/utils/phone'
import { listCustomers, deleteCustomer, bulkAssignZone } from './actions'
import { CustomerDialog } from './_components/CustomerDialog'
import { ImportDialog } from './_components/ImportDialog'
import { BulkZoneAssignModal } from './_components/BulkZoneAssignModal'
import {
  type CustomerListResponse,
  type CustomerListRow,
  type Zone,
  ZONES
} from './schema'

export default function CustomersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Ref to track if component is mounted
  const isMountedRef = useRef(true)

  // State
  const [customers, setCustomers] = useState<CustomerListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Form state
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '')
  const [selectedZone, setSelectedZone] = useState<Zone | 'all'>(
    (searchParams.get('zone') as Zone) || 'all'
  )
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [pageSize] = useState(Number(searchParams.get('pageSize')) || 25)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [bulkZoneDialogOpen, setBulkZoneDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerListRow | null>(null)

  // Selection state
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [isAllSelected, setIsAllSelected] = useState(false)

  // Debounced search
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300)

  // Safe customers array - handle null and extract rows
  const safeCustomers = customers?.rows || []

  // Update URL params (only if component is still mounted)
  const updateUrlParams = (updates: Record<string, string | number | null>) => {
    if (!isMountedRef.current) {
      console.log('🛑 Skipping URL update - component unmounted')
      return
    }

    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value.toString())
      }
    })

    // Reset page to 1 when search/filter changes
    if ('q' in updates || 'zone' in updates) {
      params.delete('page')
    }

    router.push(`/customers?${params.toString()}`, { scroll: false })
  }

  // Load customers
  const loadCustomers = async () => {
    setLoading(true)
    startTransition(async () => {
      try {
        const response = await listCustomers({
          q: debouncedSearchTerm || undefined,
          zone: selectedZone === 'all' ? undefined : selectedZone,
          page,
          pageSize
        })

        if (response.success) {
          console.log('[Debug] Customer data:', {
            type: typeof response.data,
            isArray: Array.isArray(response.data),
            hasRows: response.data && 'rows' in response.data,
            rowsIsArray: response.data && Array.isArray(response.data.rows),
            rowsLength: response.data && response.data.rows ? response.data.rows.length : 0,
            data: response.data
          })
          setCustomers(response.data)
        } else {
          throw new Error(response.error || 'Failed to load customers')
        }
      } catch (error) {
        console.error('Failed to load customers:', error)
        toast.error('Failed to load customers')
        setCustomers({ rows: [], total: 0, page: 1, pageSize, totalPages: 0 })
      } finally {
        setLoading(false)
      }
    })
  }

  // Cleanup on unmount - prevents router.push when navigating away
  useEffect(() => {
    console.log('✅ Customers page mounted')
    return () => {
      console.log('🧹 Customers page cleanup - navigating away')
      isMountedRef.current = false
    }
  }, [])

  // Load customers when search/filter changes
  useEffect(() => {
    if (isMountedRef.current) {
      loadCustomers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, selectedZone, page])

  // Update URL params when search/filter changes
  useEffect(() => {
    if (isMountedRef.current) {
      updateUrlParams({
        q: debouncedSearchTerm,
        zone: selectedZone,
        page: page > 1 ? page : null
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, selectedZone, page])

  // Handlers
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setPage(1)
  }

  const handleZoneChange = (value: string) => {
    setSelectedZone(value as Zone | 'all')
    setPage(1)
  }

  const handleCreateCustomer = () => {
    setEditingCustomer(null)
    setDialogOpen(true)
  }

  const handleExportAll = async () => {
    try {
      setLoading(true)

      // Trigger download via API route
      const response = await fetch('/api/customers/export')

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Get the blob and trigger download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success('Customer list exported successfully')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export customer list')
    } finally {
      setLoading(false)
    }
  }

  const handleEditCustomer = (customer: CustomerListRow) => {
    setEditingCustomer(customer)
    setDialogOpen(true)
  }

  const handleDeleteCustomer = async (customer: CustomerListRow) => {
    if (!confirm(`Are you sure you want to delete ${customer.name}?`)) {
      return
    }

    startTransition(async () => {
      try {
        const response = await deleteCustomer({ id: customer.id })

        if (response.success) {
          toast.success('Customer deleted successfully')
          loadCustomers()
        } else {
          throw new Error(response.error || 'Failed to delete customer')
        }
      } catch (error) {
        console.error('Failed to delete customer:', error)
        toast.error('Failed to delete customer')
      }
    })
  }

  const handleDialogSuccess = () => {
    loadCustomers()
  }

  // Selection handlers
  const toggleCustomerSelection = (customerId: string) => {
    const newSelection = new Set(selectedCustomers)
    if (newSelection.has(customerId)) {
      newSelection.delete(customerId)
    } else {
      newSelection.add(customerId)
    }
    setSelectedCustomers(newSelection)
    setIsAllSelected(newSelection.size === safeCustomers.length && safeCustomers.length > 0)
  }

  const toggleAllSelection = () => {
    if (isAllSelected) {
      setSelectedCustomers(new Set())
      setIsAllSelected(false)
    } else {
      setSelectedCustomers(new Set(safeCustomers.map(c => c.id)))
      setIsAllSelected(true)
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedCustomers.size} customers?`)) {
      return
    }

    startTransition(async () => {
      try {
        let successCount = 0
        let errorCount = 0

        // Delete customers one by one
        for (const customerId of selectedCustomers) {
          try {
            const response = await deleteCustomer({ id: customerId })
            if (response.success) {
              successCount++
            } else {
              errorCount++
              console.error(`Failed to delete customer ${customerId}:`, response.error)
            }
          } catch (error) {
            errorCount++
            console.error(`Failed to delete customer ${customerId}:`, error)
          }
        }

        // Clear selection and reload
        setSelectedCustomers(new Set())
        setIsAllSelected(false)
        loadCustomers()

        // Show appropriate toast message
        if (successCount > 0 && errorCount === 0) {
          toast.success(`Successfully deleted ${successCount} customer${successCount !== 1 ? 's' : ''}`)
        } else if (successCount > 0 && errorCount > 0) {
          toast.success(`Deleted ${successCount} customers, failed to delete ${errorCount}`)
        } else {
          toast.error(`Failed to delete all ${errorCount} customers`)
        }
      } catch (error) {
        console.error('Bulk delete failed:', error)
        toast.error('Failed to delete customers')
      }
    })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString()
  }

  const getZoneDisplay = (zone: Zone | null) => {
    if (!zone) return null
    return zone === 'Central' ? 'Central' : `Zone ${zone}`
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <PageHeader
          title="Customers"
          description="Manage customer information and service history"
          actions={
            <div className="flex gap-2">
              <Button onClick={() => setImportDialogOpen(true)} variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
              <Button onClick={handleExportAll} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button onClick={handleCreateCustomer} className="gap-2">
                <Plus className="h-4 w-4" />
                New Customer
              </Button>
            </div>
          }
        />

        {/* Filters */}
        <div className="section-card">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or address..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
                aria-label="Search customers"
              />
            </div>
            <Select
              value={selectedZone}
              onValueChange={handleZoneChange}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {ZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {getZoneDisplay(zone)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results */}
        <div className="section-card">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Customer Directory</CardTitle>
                <CardDescription>
                  {loading ? (
                    <Skeleton className="h-4 w-32" />
                  ) : (
                    `${customers?.total || 0} customers found`
                  )}
                </CardDescription>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="table-row w-full" />
              ))}
            </div>
          ) : safeCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No customers found</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {searchTerm || selectedZone !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by creating your first customer'
                }
              </p>
              {!searchTerm && selectedZone === 'all' && (
                <Button onClick={handleCreateCustomer} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Customer
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Bulk Actions Bar */}
              {selectedCustomers.size > 0 && (
                <div className="bg-gray-50 px-6 py-3 border border-gray-200 rounded-lg mb-4 flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    {selectedCustomers.size} customer{selectedCustomers.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleBulkDelete}
                      variant="destructive"
                      size="sm"
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected
                    </Button>
                    <Button
                      onClick={() => setBulkZoneDialogOpen(true)}
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                    >
                      Assign Zone
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedCustomers(new Set())
                        setIsAllSelected(false)
                      }}
                      variant="ghost"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={isAllSelected && safeCustomers.length > 0}
                          onCheckedChange={toggleAllSelection}
                          disabled={safeCustomers.length === 0}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Last Service</TableHead>
                      <TableHead className="w-[50px]">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeCustomers.map((customer) => (
                      <TableRow key={customer.id} className="table-row">
                        <TableCell className="table-cell">
                          <Checkbox
                            checked={selectedCustomers.has(customer.id)}
                            onCheckedChange={() => toggleCustomerSelection(customer.id)}
                          />
                        </TableCell>
                        <TableCell className="table-cell font-medium">
                          <div>
                            <div className="font-medium">{customer.name}</div>
                            {customer.email && (
                              <div className="text-sm text-muted-foreground">
                                {customer.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="table-cell">
                          {customer.phone_e164 ? (
                            <span className="font-mono text-sm">
                              {formatForDisplay(customer.phone_e164)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="table-cell">
                          {customer.city && customer.state ? (
                            <div>
                              <div>{customer.city}, {customer.state}</div>
                              {customer.address_line1 && (
                                <div className="text-sm text-muted-foreground">
                                  {customer.address_line1}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="table-cell">
                          {customer.zone ? (
                            <Badge variant="secondary">
                              {getZoneDisplay(customer.zone)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="table-cell">
                          <span className="text-sm">
                            {formatDate(customer.last_service_date)}
                          </span>
                        </TableCell>
                        <TableCell className="table-cell">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                aria-label={`Actions for ${customer.name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/customers/${customer.id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleEditCustomer(customer)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteCustomer(customer)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {customers && customers.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {((customers.page - 1) * customers.pageSize) + 1} to{' '}
                    {Math.min(customers.page * customers.pageSize, customers.total)} of{' '}
                    {customers.total} customers
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1 || isPending}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {customers.page} of {customers.totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= customers.totalPages || isPending}
                      aria-label="Next page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Customer Dialog */}
        <CustomerDialog
          mode={editingCustomer ? 'edit' : 'create'}
          initialData={editingCustomer || undefined}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={handleDialogSuccess}
        />

        {/* Import Dialog */}
        <ImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImportComplete={handleDialogSuccess}
        />

        {/* Bulk Zone Assignment Modal */}
        <BulkZoneAssignModal
          open={bulkZoneDialogOpen}
          onOpenChange={setBulkZoneDialogOpen}
          selectedCustomerIds={selectedCustomers}
          onSuccess={() => {
            setSelectedCustomers(new Set())
            setIsAllSelected(false)
            loadCustomers()
          }}
        />
      </div>
    </PageShell>
  )
}