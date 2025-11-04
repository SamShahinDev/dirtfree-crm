/**
 * Lazy Loaded Components
 *
 * This file contains dynamically imported components for code splitting
 * and improved initial page load performance.
 *
 * Benefits:
 * - Reduces initial bundle size
 * - Faster time to interactive
 * - Components load only when needed
 */

import dynamic from 'next/dynamic'
import { ComponentType } from 'react'

// =====================================================
// Loading Skeletons
// =====================================================

const ChartSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-64 bg-gray-200 rounded-lg"></div>
  </div>
)

const BoardSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-96 bg-gray-200 rounded-lg"></div>
  </div>
)

const ChatbotSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-16 w-16 bg-blue-200 rounded-full"></div>
  </div>
)

const TableSkeleton = () => (
  <div className="animate-pulse space-y-2">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-12 bg-gray-200 rounded"></div>
    ))}
  </div>
)

const ModalSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-96 bg-gray-200 rounded-lg"></div>
  </div>
)

// =====================================================
// Analytics Components (Heavy Charts)
// =====================================================

/**
 * Revenue Chart - Lazy loaded analytics chart
 * Uses: Chart.js or Recharts (heavy dependency)
 */
export const LazyRevenueChart = dynamic(
  () => import('./analytics/RevenueChart').then((mod) => mod.RevenueChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false, // Don't render on server (charts use browser APIs)
  }
)

/**
 * Analytics Dashboard - Complex analytics view
 */
export const LazyAnalyticsDashboard = dynamic(
  () => import('./analytics/AnalyticsDashboard').then((mod) => mod.AnalyticsDashboard),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
)

/**
 * Customer Analytics Chart
 */
export const LazyCustomerAnalytics = dynamic(
  () => import('./analytics/CustomerAnalytics').then((mod) => mod.CustomerAnalytics),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
)

/**
 * Service Performance Chart
 */
export const LazyServicePerformanceChart = dynamic(
  () => import('./analytics/ServicePerformanceChart').then((mod) => mod.ServicePerformanceChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
)

// =====================================================
// Interactive Components
// =====================================================

/**
 * Chatbot Interface - Interactive chat
 * Loaded only when user opens chat
 */
export const LazyChatbot = dynamic(
  () => import('./chatbot/ChatbotInterface').then((mod) => mod.ChatbotInterface),
  {
    loading: () => <ChatbotSkeleton />,
    ssr: false, // Client-side only
  }
)

/**
 * Opportunity Board - Drag-and-drop kanban
 * Heavy due to DnD libraries
 */
export const LazyOpportunityBoard = dynamic(
  () => import('./opportunities/OpportunityBoard').then((mod) => mod.OpportunityBoard),
  {
    loading: () => <BoardSkeleton />,
    ssr: false, // DnD requires browser APIs
  }
)

/**
 * Calendar View - Full calendar with events
 * Heavy dependency (FullCalendar)
 */
export const LazyCalendarView = dynamic(
  () => import('./calendar/CalendarView').then((mod) => mod.CalendarView),
  {
    loading: () => <BoardSkeleton />,
    ssr: false,
  }
)

/**
 * Rich Text Editor - For notes and descriptions
 */
export const LazyRichTextEditor = dynamic(
  () => import('./editor/RichTextEditor').then((mod) => mod.RichTextEditor),
  {
    loading: () => <div className="h-64 animate-pulse bg-gray-200 rounded"></div>,
    ssr: false,
  }
)

// =====================================================
// Modal/Dialog Components
// =====================================================

/**
 * Customer Detail Modal
 */
export const LazyCustomerDetailModal = dynamic(
  () => import('./customers/CustomerDetailModal').then((mod) => mod.CustomerDetailModal),
  {
    loading: () => <ModalSkeleton />,
  }
)

/**
 * Job Creation Modal
 */
export const LazyJobCreationModal = dynamic(
  () => import('./jobs/JobCreationModal').then((mod) => mod.JobCreationModal),
  {
    loading: () => <ModalSkeleton />,
  }
)

/**
 * Invoice Preview Modal
 */
export const LazyInvoicePreviewModal = dynamic(
  () => import('./invoices/InvoicePreviewModal').then((mod) => mod.InvoicePreviewModal),
  {
    loading: () => <ModalSkeleton />,
  }
)

// =====================================================
// Data Tables (Large Lists)
// =====================================================

/**
 * Advanced Customer Table with filters
 */
export const LazyCustomerTable = dynamic(
  () => import('./customers/CustomerTable').then((mod) => mod.CustomerTable),
  {
    loading: () => <TableSkeleton />,
  }
)

/**
 * Transaction History Table
 */
export const LazyTransactionTable = dynamic(
  () => import('./transactions/TransactionTable').then((mod) => mod.TransactionTable),
  {
    loading: () => <TableSkeleton />,
  }
)

/**
 * Audit Log Table
 */
export const LazyAuditLogTable = dynamic(
  () => import('./audit/AuditLogTable').then((mod) => mod.AuditLogTable),
  {
    loading: () => <TableSkeleton />,
  }
)

// =====================================================
// Portal Components
// =====================================================

/**
 * Customer Portal Dashboard
 */
export const LazyPortalDashboard = dynamic(
  () => import('./portal/PortalDashboard').then((mod) => mod.PortalDashboard),
  {
    loading: () => <div className="animate-pulse h-96 bg-gray-200 rounded-lg"></div>,
  }
)

/**
 * Promotion Claim Interface
 */
export const LazyPromotionClaim = dynamic(
  () => import('./promotions/PromotionClaim').then((mod) => mod.PromotionClaim),
  {
    loading: () => <div className="animate-pulse h-64 bg-gray-200 rounded-lg"></div>,
  }
)

/**
 * Review Submission Form
 */
export const LazyReviewForm = dynamic(
  () => import('./reviews/ReviewForm').then((mod) => mod.ReviewForm),
  {
    loading: () => <div className="animate-pulse h-96 bg-gray-200 rounded-lg"></div>,
  }
)

// =====================================================
// Settings Components
// =====================================================

/**
 * Settings Panel - Multiple tabs with complex forms
 */
export const LazySettingsPanel = dynamic(
  () => import('./settings/SettingsPanel').then((mod) => mod.SettingsPanel),
  {
    loading: () => <div className="animate-pulse h-screen bg-gray-200 rounded-lg"></div>,
  }
)

/**
 * User Management Interface
 */
export const LazyUserManagement = dynamic(
  () => import('./users/UserManagement').then((mod) => mod.UserManagement),
  {
    loading: () => <TableSkeleton />,
  }
)

// =====================================================
// Utility Components
// =====================================================

/**
 * Export Data Modal
 */
export const LazyExportModal = dynamic(
  () => import('./export/ExportModal').then((mod) => mod.ExportModal),
  {
    loading: () => <ModalSkeleton />,
  }
)

/**
 * Import Data Modal
 */
export const LazyImportModal = dynamic(
  () => import('./import/ImportModal').then((mod) => mod.ImportModal),
  {
    loading: () => <ModalSkeleton />,
  }
)

/**
 * PDF Preview Component
 */
export const LazyPDFPreview = dynamic(
  () => import('./pdf/PDFPreview').then((mod) => mod.PDFPreview),
  {
    loading: () => <div className="animate-pulse h-96 bg-gray-200 rounded-lg"></div>,
    ssr: false,
  }
)

// =====================================================
// Map Components
// =====================================================

/**
 * Service Area Map - Heavy mapping library
 */
export const LazyServiceAreaMap = dynamic(
  () => import('./maps/ServiceAreaMap').then((mod) => mod.ServiceAreaMap),
  {
    loading: () => <div className="animate-pulse h-96 bg-gray-200 rounded-lg"></div>,
    ssr: false, // Maps require browser APIs
  }
)

/**
 * Technician Route Map
 */
export const LazyRouteMap = dynamic(
  () => import('./maps/RouteMap').then((mod) => mod.RouteMap),
  {
    loading: () => <div className="animate-pulse h-96 bg-gray-200 rounded-lg"></div>,
    ssr: false,
  }
)

// =====================================================
// Export All
// =====================================================

export {
  ChartSkeleton,
  BoardSkeleton,
  ChatbotSkeleton,
  TableSkeleton,
  ModalSkeleton,
}

// Type exports for better TypeScript support
export type LazyComponentType<T = any> = ComponentType<T>
