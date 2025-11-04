'use client';

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Clock, MapPin, User, Briefcase, Sparkles, Sofa, Grid3x3, CheckCircle2, Loader2 } from "lucide-react";
import { getCustomersForSelect } from "@/app/(dashboard)/customers/actions";
import { createJob } from "@/app/(dashboard)/jobs/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  customer_id: z.string().min(1, "Please select a customer"),
  service_type: z.string().min(1, "Please select a service type"),
  date: z.date({
    required_error: "Please select a date",
  }),
  time: z.string().min(1, "Please select a time"),
  duration: z.string().min(1, "Please select duration"),
  address: z.string().min(1, "Please enter the service address"),
  technician_id: z.string().optional(),
  notes: z.string().optional(),
});

interface Customer {
  id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  zone: string | null;
}

interface ScheduleJobModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialData?: {
    date?: string;
    startTime?: string;
    endTime?: string;
    technicianId?: string;
  };
  onSuccess?: () => void;
}

export function ScheduleJobModal({
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  initialData,
  onSuccess
}: ScheduleJobModalProps = {}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const router = useRouter();

  // Use external state if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_id: "",
      service_type: "",
      time: "",
      duration: "2",
      address: "",
      technician_id: "",
      notes: "",
    },
  });

  // Define loadCustomers BEFORE the useEffect that calls it
  async function loadCustomers() {
    try {
      console.log('🔍 Loading customers...');
      const response = await getCustomersForSelect({});
      console.log('📦 Customer response:', response);

      if (response.success && response.data) {
        console.log(`✅ Setting ${response.data.length} customers`);
        setCustomers(response.data);
      } else {
        console.error('❌ Response not ok or no data:', response);
        toast.error('Failed to load customers - check console');
      }
    } catch (error) {
      console.error('💥 Failed to load customers:', error);
      toast.error('Error: ' + (error instanceof Error ? error.message : 'Unknown'));
    }
  }

  // TEST: Verify function exists
  console.log('Testing loadCustomers function exists:', typeof loadCustomers);

  // Load customers when modal opens
  React.useEffect(() => {
    console.log('useEffect triggered! open =', open);
    if (open) {
      console.log('Modal is open, loading customers...');
      loadCustomers();
    } else {
      console.log('Modal is closed, skipping customer load');
    }
  }, [open]);

  // Pre-fill form with initialData when provided
  React.useEffect(() => {
    if (initialData && open) {
      console.log('📋 Pre-filling form with initial data:', initialData);

      if (initialData.date) {
        form.setValue('date', new Date(initialData.date));
      }

      if (initialData.startTime) {
        // Convert 24-hour format to 12-hour format with AM/PM
        const [hours, minutes] = initialData.startTime.split(':');
        const hour = parseInt(hours);
        const period = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const time12h = `${String(hour12).padStart(2, '0')}:${minutes} ${period}`;
        form.setValue('time', time12h);
      }

      if (initialData.endTime && initialData.startTime) {
        // Calculate duration in hours
        const [startHours, startMinutes] = initialData.startTime.split(':').map(Number);
        const [endHours, endMinutes] = initialData.endTime.split(':').map(Number);
        const durationHours = (endHours * 60 + endMinutes - startHours * 60 - startMinutes) / 60;
        form.setValue('duration', String(Math.round(durationHours)));
      }

      if (initialData.technicianId) {
        form.setValue('technician_id', initialData.technicianId);
      }
    }
  }, [initialData, open, form]);

  // Track customers state changes
  React.useEffect(() => {
    console.log('Customers state updated:', customers.length, 'customers');
  }, [customers]);

  // Function to determine zone from customer
  async function getZoneFromCustomer(customerId: string) {
    const customer = customers.find(c => c.id === customerId);
    return customer?.zone || 'N'; // Default to North if not found
  }

  // Convert 12-hour time to 24-hour format
  function convertTo24Hour(time12h: string): string {
    const [time, period] = time12h.split(' ');
    let [hours, minutes] = time.split(':');

    if (period === 'PM' && hours !== '12') {
      hours = String(parseInt(hours) + 12);
    } else if (period === 'AM' && hours === '12') {
      hours = '00';
    }

    return `${hours.padStart(2, '0')}:${minutes}`;
  }

  // Calculate end time based on start time and duration
  function calculateEndTime(startTime: string, durationHours: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = hours + durationHours;
    return `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setLoading(true);
      console.log("Scheduling job:", values);

      const zone = await getZoneFromCustomer(values.customer_id);

      // Convert time to 24-hour format
      const startTime24 = convertTo24Hour(values.time);
      const endTime24 = calculateEndTime(startTime24, parseInt(values.duration));

      // Prepare job data for server action
      const jobData = {
        customerId: values.customer_id,
        zone: zone,
        scheduledDate: format(values.date, 'yyyy-MM-dd'),
        scheduledTimeStart: startTime24,
        scheduledTimeEnd: endTime24,
        description: `${values.service_type}\n${values.notes || ''}`.trim(),
        technicianId: values.technician_id || undefined,
        invoiceUrl: null
      };

      const response = await createJob(jobData);

      if (!response.success) {
        throw new Error(response.error || 'Failed to create job');
      }

      toast.success('Job scheduled successfully');

      // Reset form and close modal
      form.reset();
      setOpen(false);

      // Call onSuccess callback if provided (for external control)
      if (onSuccess) {
        onSuccess();
      } else {
        // Stay on dashboard after successful job creation (default behavior)
        router.push('/dashboard');
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to schedule job:", error);
      toast.error(error instanceof Error ? error.message : 'Failed to schedule job. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const serviceTypes = [
    { value: "carpet-cleaning", label: "Carpet Cleaning" },
    { value: "upholstery", label: "Upholstery Cleaning" },
    { value: "tile-grout", label: "Tile & Grout Cleaning" },
    { value: "pet-odor", label: "Pet Odor Removal" },
    { value: "water-damage", label: "Water Damage Restoration" },
  ];

  const timeSlots = [
    "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
    "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM",
    "04:00 PM", "05:00 PM", "06:00 PM"
  ];

  React.useEffect(() => {
    console.log('ScheduleJobModal mounted');
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="relative z-10 cursor-pointer"
          onClick={() => console.log('Schedule Job button clicked!')}
        >
          <Briefcase className="mr-2 h-4 w-4 pointer-events-none" />
          <span className="pointer-events-none">Schedule Job</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto z-50">
        <DialogHeader className="space-y-3 pb-4 border-b">
          <DialogTitle className="text-2xl font-semibold">Schedule New Job</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Create a new service appointment for a customer.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Customer</FormLabel>
                    <Select onValueChange={(value) => {
                      field.onChange(value);
                      const customer = customers.find(c => c.id === value);
                      if (customer && customer.address_line1) {
                        const addressParts = [
                          customer.address_line1,
                          customer.city,
                          customer.state,
                          customer.postal_code
                        ].filter(Boolean);
                        const fullAddress = addressParts.join(', ');
                        form.setValue('address', fullAddress);
                      }
                    }} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 opacity-50" />
                              {customer.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="service_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Service Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="carpet-cleaning">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-blue-500" />
                            Carpet Cleaning
                          </div>
                        </SelectItem>
                        <SelectItem value="upholstery">
                          <div className="flex items-center gap-2">
                            <Sofa className="h-4 w-4 text-purple-500" />
                            Upholstery Cleaning
                          </div>
                        </SelectItem>
                        <SelectItem value="tile-grout">
                          <div className="flex items-center gap-2">
                            <Grid3x3 className="h-4 w-4 text-green-500" />
                            Tile & Grout Cleaning
                          </div>
                        </SelectItem>
                        <SelectItem value="pet-odor">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-amber-500" />
                            Pet Odor Removal
                          </div>
                        </SelectItem>
                        <SelectItem value="water-damage">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-cyan-500" />
                            Water Damage Restoration
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Service Address Display - Enhanced card when customer selected */}
            {form.watch('customer_id') && customers.find(c => c.id === form.watch('customer_id')) && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Service Address</p>
                    <p className="text-sm text-muted-foreground">
                      {(() => {
                        const customer = customers.find(c => c.id === form.watch('customer_id'));
                        if (!customer) return 'No address available';
                        const parts = [];
                        if (customer.address_line1) parts.push(customer.address_line1);
                        const cityStateZip = [customer.city, customer.state, customer.postal_code].filter(Boolean).join(' ');
                        if (cityStateZip) parts.push(cityStateZip);
                        return parts.join(', ') || 'No address available';
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Hidden field to store address */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <input type="hidden" {...field} />
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-sm font-medium">Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-11",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                          className="rounded-md border shadow-md"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Start Time</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 opacity-50" />
                              {time}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Duration</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || "2"}
                      defaultValue="2"
                    >
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">1 hour</SelectItem>
                        <SelectItem value="2">2 hours</SelectItem>
                        <SelectItem value="3">3 hours</SelectItem>
                        <SelectItem value="4">4 hours</SelectItem>
                        <SelectItem value="5">5 hours</SelectItem>
                        <SelectItem value="6">6 hours</SelectItem>
                        <SelectItem value="8">8 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Special instructions, access codes, or additional details..."
                      className="resize-none min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Add any special instructions or details for the technician
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-11"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="h-11 min-w-[140px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Schedule Job
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}