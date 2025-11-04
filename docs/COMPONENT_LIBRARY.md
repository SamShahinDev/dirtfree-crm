# Component Library

UI component documentation and usage guide for Dirt Free CRM.

## Table of Contents

1. [UI Components (shadcn/ui)](#ui-components-shadcnui)
2. [Form Components](#form-components)
3. [Data Display](#data-display)
4. [Analytics Components](#analytics-components)
5. [Portal Components](#portal-components)
6. [Layout Components](#layout-components)
7. [Utility Components](#utility-components)
8. [Component Patterns](#component-patterns)

---

## UI Components (shadcn/ui)

The project uses shadcn/ui components built on Radix UI and Tailwind CSS.

### Installation

Components are installed individually:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
```

### Button

**Import:**
```typescript
import { Button } from '@/components/ui/button'
```

**Usage:**
```tsx
<Button variant="default">Click Me</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button disabled>Disabled</Button>
```

**Props:**
```typescript
interface ButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg'
  disabled?: boolean
  onClick?: () => void
}
```

### Card

**Import:**
```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
```

**Usage:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
</Card>
```

### Dialog

**Import:**
```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
```

**Usage:**
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Dialog description</DialogDescription>
    </DialogHeader>
    {/* Dialog content */}
  </DialogContent>
</Dialog>
```

### Table

**Import:**
```typescript
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
```

**Usage:**
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {data.map((item) => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell>{item.status}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Select

**Import:**
```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
```

**Usage:**
```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

### Badge

**Import:**
```typescript
import { Badge } from '@/components/ui/badge'
```

**Usage:**
```tsx
<Badge>Default</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Destructive</Badge>
```

**Custom Styling:**
```tsx
<Badge className="bg-green-100 text-green-800">
  Success
</Badge>
```

---

## Form Components

### Input

**Import:**
```typescript
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
```

**Usage:**
```tsx
<div>
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="Enter email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
</div>
```

### Form with React Hook Form

**Setup:**
```bash
npm install react-hook-form zod @hookform/resolvers
```

**Usage:**
```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const formSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
})

export function MyForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      name: '',
    },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Enter email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
```

### Switch

**Import:**
```typescript
import { Switch } from '@/components/ui/switch'
```

**Usage:**
```tsx
<div className="flex items-center space-x-2">
  <Switch
    id="notifications"
    checked={enabled}
    onCheckedChange={setEnabled}
  />
  <Label htmlFor="notifications">Enable notifications</Label>
</div>
```

---

## Data Display

### Alert

**Import:**
```typescript
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
```

**Usage:**
```tsx
<Alert>
  <AlertTriangle className="h-4 w-4" />
  <AlertTitle>Warning</AlertTitle>
  <AlertDescription>
    This action cannot be undone.
  </AlertDescription>
</Alert>

<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Something went wrong.
  </AlertDescription>
</Alert>
```

### Toast Notifications

**Setup:**
```bash
npm install sonner
```

**Import:**
```typescript
import { toast } from 'sonner'
```

**Usage:**
```typescript
toast.success('Operation successful')
toast.error('Operation failed')
toast.info('Information message')
toast.warning('Warning message')

// Custom toast
toast('Custom message', {
  description: 'Additional details',
  action: {
    label: 'Undo',
    onClick: () => console.log('Undo'),
  },
})
```

**Provider Setup:**
```tsx
// app/layout.tsx
import { Toaster } from 'sonner'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

---

## Analytics Components

### Metric Card

**Custom component for displaying metrics:**

```typescript
// components/analytics/MetricCard.tsx
interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  icon?: React.ReactNode
}

export function MetricCard({ title, value, change, icon }: MetricCardProps) {
  const isPositive = change && change > 0

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {change !== undefined && (
              <p className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? '+' : ''}{change}%
              </p>
            )}
          </div>
          {icon && (
            <div className="p-3 bg-blue-100 rounded-full">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

**Usage:**
```tsx
<MetricCard
  title="Total Revenue"
  value="$45,231"
  change={12.5}
  icon={<DollarSign className="h-6 w-6 text-blue-600" />}
/>
```

### Charts (Recharts)

**Installation:**
```bash
npm install recharts
```

**Line Chart Example:**
```typescript
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const data = [
  { date: '2025-01-01', revenue: 4000 },
  { date: '2025-01-02', revenue: 3000 },
  { date: '2025-01-03', revenue: 5000 },
]

export function RevenueChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="revenue" stroke="#3b82f6" />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

**Bar Chart Example:**
```typescript
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const data = [
  { name: 'Jan', value: 400 },
  { name: 'Feb', value: 300 },
  { name: 'Mar', value: 600 },
]

export function MonthlyChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

---

## Portal Components

### Customer Navigation

```typescript
// components/portal/PortalNav.tsx
export function PortalNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard/portal', label: 'Dashboard', icon: Home },
    { href: '/dashboard/portal/services', label: 'Services', icon: Briefcase },
    { href: '/dashboard/portal/invoices', label: 'Invoices', icon: FileText },
    { href: '/dashboard/portal/promotions', label: 'Promotions', icon: Gift },
    { href: '/dashboard/portal/loyalty', label: 'Loyalty', icon: Star },
  ]

  return (
    <nav className="space-y-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
            pathname === item.href
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent'
          )}
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
```

### Service History Card

```typescript
// components/portal/ServiceCard.tsx
interface ServiceCardProps {
  service: {
    service_type: string
    service_date: string
    status: string
    total_amount: number
  }
}

export function ServiceCard({ service }: ServiceCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{service.service_type}</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(service.service_date).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold">${service.total_amount.toFixed(2)}</p>
            <Badge>{service.status}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Layout Components

### Page Layout

```typescript
// components/layout/PageLayout.tsx
interface PageLayoutProps {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function PageLayout({ title, description, actions, children }: PageLayoutProps) {
  return (
    <div className="container mx-auto py-8 max-w-[1600px]">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{title}</h1>
            {description && (
              <p className="text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}
```

**Usage:**
```tsx
<PageLayout
  title="Opportunities"
  description="Manage missed opportunities"
  actions={
    <>
      <Button variant="outline">Filter</Button>
      <Button>New Opportunity</Button>
    </>
  }
>
  {/* Page content */}
</PageLayout>
```

### Loading States

```typescript
// components/layout/LoadingSpinner.tsx
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <RefreshCw className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

// Skeleton loader
export function SkeletonCard() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Utility Components

### Error Boundary

```typescript
'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600">Something went wrong</h2>
          <Button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Usage:**
```tsx
<ErrorBoundary fallback={<CustomError />}>
  <YourComponent />
</ErrorBoundary>
```

---

## Component Patterns

### Server Component (Default)

```typescript
// app/dashboard/page.tsx
export default async function DashboardPage() {
  const data = await fetchData() // Server-side data fetching

  return (
    <div>
      <h1>Dashboard</h1>
      <DataDisplay data={data} />
    </div>
  )
}
```

### Client Component

```typescript
'use client'

import { useState } from 'react'

export function InteractiveComponent() {
  const [count, setCount] = useState(0)

  return (
    <Button onClick={() => setCount(count + 1)}>
      Count: {count}
    </Button>
  )
}
```

### Hybrid Pattern

```typescript
// Server component (parent)
export default async function Page() {
  const initialData = await fetchData()

  return <ClientComponent initialData={initialData} />
}

// Client component (child)
'use client'

export function ClientComponent({ initialData }) {
  const [data, setData] = useState(initialData)
  // Interactive logic
}
```

### Data Fetching

```typescript
// Server component
async function getData() {
  const res = await fetch('https://api.example.com/data', {
    cache: 'no-store', // Always fresh
  })
  return res.json()
}

export default async function Page() {
  const data = await getData()
  return <div>{data.title}</div>
}
```

### Loading UI

```typescript
// app/dashboard/loading.tsx
export default function Loading() {
  return <LoadingSpinner />
}
```

### Error UI

```typescript
// app/dashboard/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
```

---

**Last Updated:** 2025-01-24
