import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

// Loading component
const LoadingSpinner = ({ message = 'Loading...' }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center p-8">
    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    <p className="mt-2 text-sm text-gray-600">{message}</p>
  </div>
)

// Heavy chart components (lazy load)
export const AnalyticsChart = dynamic(
  () => import('@/components/analytics/analytics-chart').then(mod => mod.AnalyticsChart),
  {
    loading: () => <LoadingSpinner message="Loading chart..." />,
    ssr: false
  }
)

export const RevenueChart = dynamic(
  () => import('@/components/analytics/revenue-chart').then(mod => mod.RevenueChart),
  {
    loading: () => <LoadingSpinner message="Loading revenue data..." />,
    ssr: false
  }
)

// PDF generation components
export const InvoicePDF = dynamic(
  () => import('@/components/invoices/invoice-pdf').then(mod => mod.InvoicePDF),
  {
    loading: () => <LoadingSpinner message="Preparing PDF..." />,
    ssr: false
  }
)

export const ReportGenerator = dynamic(
  () => import('@/components/reports/report-generator').then(mod => mod.ReportGenerator),
  {
    loading: () => <LoadingSpinner message="Generating report..." />,
    ssr: false
  }
)

// Map components
export const RouteMap = dynamic(
  () => import('@/components/maps/route-map').then(mod => mod.RouteMap),
  {
    loading: () => <LoadingSpinner message="Loading map..." />,
    ssr: false
  }
)

export const CustomerLocationMap = dynamic(
  () => import('@/components/maps/customer-location-map').then(mod => mod.CustomerLocationMap),
  {
    loading: () => <LoadingSpinner message="Loading location..." />,
    ssr: false
  }
)

// Rich text editor
export const RichTextEditor = dynamic(
  () => import('@/components/editors/rich-text-editor').then(mod => mod.RichTextEditor),
  {
    loading: () => <LoadingSpinner message="Loading editor..." />,
    ssr: false
  }
)

// Calendar components
export const FullCalendar = dynamic(
  () => import('@/components/calendar/full-calendar').then(mod => mod.FullCalendar),
  {
    loading: () => <LoadingSpinner message="Loading calendar..." />,
    ssr: false
  }
)

// File upload components
export const FileDropzone = dynamic(
  () => import('@/components/uploads/file-dropzone').then(mod => mod.FileDropzone),
  {
    loading: () => <LoadingSpinner message="Preparing upload..." />,
    ssr: true
  }
)

// Data export components
export const ExportDialog = dynamic(
  () => import('@/components/exports/export-dialog').then(mod => mod.ExportDialog),
  {
    loading: () => <LoadingSpinner message="Loading export options..." />,
    ssr: false
  }
)

// QR code generator
export const QRCodeGenerator = dynamic(
  () => import('@/components/tools/qr-code-generator').then(mod => mod.QRCodeGenerator),
  {
    loading: () => <LoadingSpinner message="Loading QR generator..." />,
    ssr: false
  }
)

// Heavy table components
export const DataTable = dynamic(
  () => import('@/components/tables/data-table').then(mod => mod.DataTable),
  {
    loading: () => <LoadingSpinner message="Loading table..." />,
    ssr: true
  }
)

// Image gallery
export const ImageGallery = dynamic(
  () => import('@/components/gallery/image-gallery').then(mod => mod.ImageGallery),
  {
    loading: () => <LoadingSpinner message="Loading images..." />,
    ssr: false
  }
)

// Modals that are not immediately needed
export const ImportWizard = dynamic(
  () => import('@/components/imports/import-wizard').then(mod => mod.ImportWizard),
  {
    loading: () => <LoadingSpinner message="Loading import wizard..." />,
    ssr: false
  }
)

export const SettingsPanel = dynamic(
  () => import('@/components/settings/settings-panel').then(mod => mod.SettingsPanel),
  {
    loading: () => <LoadingSpinner message="Loading settings..." />,
    ssr: false
  }
)

// Helper function to preload a dynamic component
export function preloadComponent(componentName: keyof typeof dynamicComponents) {
  const component = dynamicComponents[componentName]
  if (component && 'preload' in component) {
    component.preload()
  }
}

// Export all dynamic components for easy preloading
const dynamicComponents = {
  AnalyticsChart,
  RevenueChart,
  InvoicePDF,
  ReportGenerator,
  RouteMap,
  CustomerLocationMap,
  RichTextEditor,
  FullCalendar,
  FileDropzone,
  ExportDialog,
  QRCodeGenerator,
  DataTable,
  ImageGallery,
  ImportWizard,
  SettingsPanel
} as const

export default dynamicComponents