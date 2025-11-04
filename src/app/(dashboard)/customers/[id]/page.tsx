'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'

import {
  ArrowLeft,
  Edit,
  Download,
  ChevronDown,
  ChevronRight,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Calendar,
  ExternalLink,
  History
} from 'lucide-react'

import { formatForDisplay } from '@/lib/utils/phone'
import { getCustomer } from '../actions'
import { CustomerDialog } from '../_components/CustomerDialog'
import { type CustomerDetail } from '../schema'

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string

  // State
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [serviceHistoryOpen, setServiceHistoryOpen] = useState(true)

  // Load customer data
  const loadCustomer = async () => {
    setLoading(true)
    try {
      const response = await getCustomer({ id: customerId })

      if (response.success) {
        setCustomer(response.data)
      } else {
        throw new Error(response.error || 'Failed to load customer')
      }
    } catch (error) {
      console.error('Failed to load customer:', error)
      toast.error('Failed to load customer details')
      router.push('/customers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (customerId) {
      loadCustomer()
    }
  }, [customerId])

  const handleDialogSuccess = () => {
    loadCustomer()
  }

  const handleExportCsv = () => {
    window.open(`/customers/${customerId}/export`, '_blank')
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getZoneDisplay = (zone: string | null) => {
    if (!zone) return null
    return zone === 'Central' ? 'Central' : `Zone ${zone}`
  }

  const getFullAddress = (customer: CustomerDetail) => {
    const parts = [
      customer.address_line1,
      customer.address_line2,
      customer.city,
      customer.state,
      customer.postal_code
    ].filter(Boolean)

    return parts.length > 0 ? parts.join(', ') : null
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <User className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">Customer not found</h3>
        <p className="text-sm text-muted-foreground mt-2">
          The customer you're looking for doesn't exist or you don't have permission to view it.
        </p>
        <Button asChild className="mt-4">
          <Link href="/customers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Customers
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/customers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {customer.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Customer since {formatDate(customer.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportCsv}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            onClick={() => setDialogOpen(true)}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit Customer
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Customer Profile */}
        <Card className="rounded-lg p-4 md:p-5 lg:p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            {/* Contact Information */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Phone</div>
                  <div className="text-sm">
                    {customer.phone_e164 ? (
                      <span className="font-mono">
                        {formatForDisplay(customer.phone_e164)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not provided</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Email</div>
                  <div className="text-sm">
                    {customer.email ? (
                      <a
                        href={`mailto:${customer.email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {customer.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Not provided</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Address</div>
                  <div className="text-sm">
                    {getFullAddress(customer) ? (
                      <div className="space-y-1">
                        {customer.address_line1 && (
                          <div>{customer.address_line1}</div>
                        )}
                        {customer.address_line2 && (
                          <div>{customer.address_line2}</div>
                        )}
                        {(customer.city || customer.state || customer.postal_code) && (
                          <div>
                            {[customer.city, customer.state, customer.postal_code]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not provided</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Service Zone */}
            {customer.zone && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Service Zone</span>
                  <Badge variant="secondary">
                    {getZoneDisplay(customer.zone)}
                  </Badge>
                </div>
              </div>
            )}

            {/* Notes */}
            {customer.notes && (
              <div className="pt-2 border-t">
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Notes</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {customer.notes}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Service History */}
        <Card className="rounded-lg">
          <Collapsible
            open={serviceHistoryOpen}
            onOpenChange={setServiceHistoryOpen}
          >
            <CardHeader className="p-4 md:p-5 lg:p-6">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="justify-between p-0 h-auto">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    <CardTitle>Service History</CardTitle>
                  </div>
                  {serviceHistoryOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CardDescription>
                {customer.service_history.length} service{customer.service_history.length !== 1 ? 's' : ''} completed
              </CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="p-0">
                {customer.service_history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4">
                    <Calendar className="h-8 w-8 text-muted-foreground" />
                    <h4 className="mt-4 font-medium">No service history</h4>
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      This customer hasn't had any completed services yet.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Technician</TableHead>
                        <TableHead>Invoice</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customer.service_history.map((service) => (
                        <TableRow key={service.id}>
                          <TableCell>
                            <div className="text-sm">
                              {formatDateTime(service.completed_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              {service.job_description || 'Service completed'}
                              {service.notes && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  {service.notes}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {service.technician_name || 'Unknown'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {service.invoice_url ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="h-8 px-2"
                              >
                                <a
                                  href={service.invoice_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>

      {/* Customer Dialog */}
      <CustomerDialog
        mode="edit"
        initialData={customer}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleDialogSuccess}
      />
    </div>
  )
}