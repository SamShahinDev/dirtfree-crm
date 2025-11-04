// Search Indexer
// Utilities for indexing entities into the centralized search index

import { createClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

export type EntityType = 'customer' | 'job' | 'invoice' | 'service' | 'page' | 'article';
export type Platform = 'crm' | 'portal' | 'website';

interface SearchIndexEntry {
  entity_type: EntityType;
  entity_id: string;
  title: string;
  description?: string;
  content?: string;
  url: string;
  platform: Platform;
  tags?: string[];
  metadata?: Record<string, any>;
}

// ============================================================================
// Customer Indexing
// ============================================================================

/**
 * Index a customer for search
 * Creates search entries for CRM
 */
export async function indexCustomer(customerId: string): Promise<void> {
  const supabase = createClient();

  try {
    // Get customer data
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error || !customer) {
      console.error('Customer not found for indexing:', customerId);
      return;
    }

    // Build search entry
    const entry: SearchIndexEntry = {
      entity_type: 'customer',
      entity_id: customer.id,
      title: `${customer.first_name} ${customer.last_name}`,
      description: [customer.email, customer.phone].filter(Boolean).join(' • '),
      content: [
        customer.address_line1,
        customer.address_line2,
        customer.city,
        customer.state,
        customer.zip_code,
      ]
        .filter(Boolean)
        .join(' '),
      url: `/dashboard/customers/${customer.id}`,
      platform: 'crm',
      tags: [customer.city, customer.state, customer.source, customer.status]
        .filter(Boolean)
        .map((tag) => tag.toLowerCase()),
      metadata: {
        email: customer.email,
        phone: customer.phone,
        totalJobs: customer.total_jobs || 0,
        lifetimeValue: customer.lifetime_value || 0,
        source: customer.source,
        status: customer.status,
      },
    };

    await upsertSearchIndex(entry);
  } catch (error) {
    console.error('Error indexing customer:', error);
  }
}

// ============================================================================
// Job Indexing
// ============================================================================

/**
 * Index a job for search
 * Creates search entries for both CRM and Portal
 */
export async function indexJob(jobId: string): Promise<void> {
  const supabase = createClient();

  try {
    // Get job data with customer
    const { data: job, error } = await supabase
      .from('jobs')
      .select(
        `
        *,
        customers (id, first_name, last_name, email, phone, portal_user_id)
      `
      )
      .eq('id', jobId)
      .single();

    if (error || !job) {
      console.error('Job not found for indexing:', jobId);
      return;
    }

    const customer = job.customers as any;
    const customerName = `${customer.first_name} ${customer.last_name}`;
    const serviceLabel = formatServiceType(job.service_type);
    const scheduledDate = job.scheduled_date
      ? new Date(job.scheduled_date).toLocaleDateString()
      : null;

    // ========================================================================
    // Index for CRM
    // ========================================================================

    const crmEntry: SearchIndexEntry = {
      entity_type: 'job',
      entity_id: job.id,
      title: `${serviceLabel} - ${customerName}`,
      description: [
        `Status: ${formatStatus(job.status)}`,
        scheduledDate && `Date: ${scheduledDate}`,
        job.zone && `Zone: ${job.zone}`,
      ]
        .filter(Boolean)
        .join(' • '),
      content: job.notes || '',
      url: `/dashboard/jobs/${job.id}`,
      platform: 'crm',
      tags: [job.status, job.service_type, job.zone, customer.city]
        .filter(Boolean)
        .map((tag) => tag.toLowerCase()),
      metadata: {
        customerName,
        customerId: customer.id,
        customerEmail: customer.email,
        status: job.status,
        serviceType: job.service_type,
        scheduledDate: job.scheduled_date,
        estimatedPrice: job.estimated_price,
        finalPrice: job.final_price,
      },
    };

    await upsertSearchIndex(crmEntry);

    // ========================================================================
    // Index for Portal (if customer has portal access)
    // ========================================================================

    if (customer.portal_user_id) {
      const portalEntry: SearchIndexEntry = {
        entity_type: 'job',
        entity_id: job.id,
        title: `${serviceLabel} Appointment`,
        description: scheduledDate ? `Scheduled for ${scheduledDate}` : 'Pending scheduling',
        content: '',
        url: `/dashboard/appointments/${job.id}`,
        platform: 'portal',
        tags: [job.status, job.service_type].filter(Boolean).map((tag) => tag.toLowerCase()),
        metadata: {
          status: job.status,
          serviceType: job.service_type,
          scheduledDate: job.scheduled_date,
        },
      };

      await upsertSearchIndex(portalEntry);
    }
  } catch (error) {
    console.error('Error indexing job:', error);
  }
}

// ============================================================================
// Invoice Indexing
// ============================================================================

/**
 * Index an invoice for search
 * Creates search entries for both CRM and Portal
 */
export async function indexInvoice(invoiceId: string): Promise<void> {
  const supabase = createClient();

  try {
    // Get invoice data with customer
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(
        `
        *,
        customers (id, first_name, last_name, email, portal_user_id),
        jobs (service_type)
      `
      )
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      console.error('Invoice not found for indexing:', invoiceId);
      return;
    }

    const customer = invoice.customers as any;
    const job = invoice.jobs as any;
    const customerName = `${customer.first_name} ${customer.last_name}`;
    const invoiceNumber = invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase();

    // ========================================================================
    // Index for CRM
    // ========================================================================

    const crmEntry: SearchIndexEntry = {
      entity_type: 'invoice',
      entity_id: invoice.id,
      title: `Invoice ${invoiceNumber} - ${customerName}`,
      description: [
        `Amount: $${invoice.total_amount}`,
        `Status: ${formatStatus(invoice.status)}`,
        job?.service_type && formatServiceType(job.service_type),
      ]
        .filter(Boolean)
        .join(' • '),
      content: invoice.notes || '',
      url: `/dashboard/invoices/${invoice.id}`,
      platform: 'crm',
      tags: [invoice.status, job?.service_type].filter(Boolean).map((tag) => tag.toLowerCase()),
      metadata: {
        customerName,
        customerId: customer.id,
        invoiceNumber,
        totalAmount: invoice.total_amount,
        status: invoice.status,
        dueDate: invoice.due_date,
        paidAt: invoice.paid_at,
      },
    };

    await upsertSearchIndex(crmEntry);

    // ========================================================================
    // Index for Portal (if customer has portal access)
    // ========================================================================

    if (customer.portal_user_id) {
      const portalEntry: SearchIndexEntry = {
        entity_type: 'invoice',
        entity_id: invoice.id,
        title: `Invoice ${invoiceNumber}`,
        description: `$${invoice.total_amount} • ${formatStatus(invoice.status)}`,
        content: '',
        url: `/dashboard/billing/${invoice.id}`,
        platform: 'portal',
        tags: [invoice.status].filter(Boolean).map((tag) => tag.toLowerCase()),
        metadata: {
          invoiceNumber,
          totalAmount: invoice.total_amount,
          status: invoice.status,
          dueDate: invoice.due_date,
        },
      };

      await upsertSearchIndex(portalEntry);
    }
  } catch (error) {
    console.error('Error indexing invoice:', error);
  }
}

// ============================================================================
// Website Page Indexing
// ============================================================================

/**
 * Index a website page for search
 */
export async function indexWebsitePage(page: {
  slug: string;
  title: string;
  description: string;
  content: string;
  tags?: string[];
}): Promise<void> {
  try {
    const entry: SearchIndexEntry = {
      entity_type: 'page',
      entity_id: page.slug,
      title: page.title,
      description: page.description,
      content: page.content,
      url: page.slug,
      platform: 'website',
      tags: page.tags || [],
      metadata: {
        slug: page.slug,
      },
    };

    await upsertSearchIndex(entry);
  } catch (error) {
    console.error('Error indexing website page:', error);
  }
}

/**
 * Index a service page for the website
 */
export async function indexService(service: {
  slug: string;
  name: string;
  description: string;
  content: string;
  price?: number;
}): Promise<void> {
  try {
    const entry: SearchIndexEntry = {
      entity_type: 'service',
      entity_id: service.slug,
      title: service.name,
      description: service.description,
      content: service.content,
      url: `/services/${service.slug}`,
      platform: 'website',
      tags: ['service', service.slug],
      metadata: {
        slug: service.slug,
        price: service.price,
      },
    };

    await upsertSearchIndex(entry);
  } catch (error) {
    console.error('Error indexing service:', error);
  }
}

// ============================================================================
// Delete Functions
// ============================================================================

/**
 * Delete search index entries for an entity
 */
export async function deleteSearchIndex(entityType: EntityType, entityId: string): Promise<void> {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('search_index')
      .delete()
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (error) {
      console.error('Error deleting search index:', error);
    }
  } catch (error) {
    console.error('Error deleting search index:', error);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Upsert a search index entry
 */
async function upsertSearchIndex(entry: SearchIndexEntry): Promise<void> {
  const supabase = createClient();

  try {
    const { error } = await supabase.from('search_index').upsert(
      {
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        title: entry.title,
        description: entry.description || null,
        content: entry.content || null,
        url: entry.url,
        platform: entry.platform,
        tags: entry.tags || [],
        metadata: entry.metadata || {},
      },
      {
        onConflict: 'entity_type,entity_id,platform',
      }
    );

    if (error) {
      console.error('Error upserting search index:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error upserting search index:', error);
    throw error;
  }
}

/**
 * Format service type for display
 */
function formatServiceType(serviceType: string): string {
  const labels: Record<string, string> = {
    carpet_cleaning: 'Carpet Cleaning',
    tile_grout: 'Tile & Grout Cleaning',
    upholstery: 'Upholstery Cleaning',
    area_rug: 'Area Rug Cleaning',
    water_damage: 'Water Damage Restoration',
    pet_treatment: 'Pet Treatment',
    scotchgard: 'Scotchgard Protection',
    air_duct: 'Air Duct Cleaning',
    natural_stone: 'Natural Stone Cleaning',
  };

  return labels[serviceType] || serviceType;
}

/**
 * Format status for display
 */
function formatStatus(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Reindex all entities of a specific type
 */
export async function reindexEntityType(
  entityType: EntityType,
  limit: number = 100
): Promise<number> {
  const supabase = createClient();
  let indexed = 0;

  try {
    if (entityType === 'customer') {
      const { data: customers } = await supabase.from('customers').select('id').limit(limit);

      if (customers) {
        for (const customer of customers) {
          await indexCustomer(customer.id);
          indexed++;
        }
      }
    } else if (entityType === 'job') {
      const { data: jobs } = await supabase.from('jobs').select('id').limit(limit);

      if (jobs) {
        for (const job of jobs) {
          await indexJob(job.id);
          indexed++;
        }
      }
    } else if (entityType === 'invoice') {
      const { data: invoices } = await supabase.from('invoices').select('id').limit(limit);

      if (invoices) {
        for (const invoice of invoices) {
          await indexInvoice(invoice.id);
          indexed++;
        }
      }
    }

    return indexed;
  } catch (error) {
    console.error(`Error reindexing ${entityType}:`, error);
    return indexed;
  }
}
