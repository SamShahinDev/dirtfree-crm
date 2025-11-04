# Cross-Platform Search

Unified search system across Website, CRM, and Customer Portal with full-text search capabilities.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Indexing System](#indexing-system)
- [Search API](#search-api)
- [Components](#components)
- [Setup Instructions](#setup-instructions)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The Cross-Platform Search system provides a centralized search index that enables users to search across all platforms (CRM, Portal, Website) with a single query. It uses PostgreSQL's full-text search with TSVECTOR for fast, relevant results.

### Key Features

- **Unified Index**: Single search index for all platforms
- **Full-Text Search**: PostgreSQL TSVECTOR with ranking
- **Real-Time Indexing**: Auto-index on create/update
- **Weighted Results**: Title > Description > Content
- **Platform Filtering**: Search within specific platforms
- **Entity Type Filtering**: Filter by customer, job, invoice, etc.
- **Tag Support**: Categorize and filter by tags
- **Keyboard Shortcuts**: Cmd/Ctrl + K to open search
- **Arrow Key Navigation**: Navigate results with keyboard

## Features

### Search Capabilities

- **Full-Text Search**: Natural language search with stemming
- **Partial Matching**: Finds "carp" when searching for "carpet"
- **Multi-Word Queries**: Searches across multiple fields
- **Ranked Results**: Most relevant results first
- **Fuzzy Matching**: Tolerates minor typos
- **Tag Filtering**: Search by category tags

### Indexed Entities

| Entity Type | Platforms | Description |
|-------------|-----------|-------------|
| `customer` | CRM | Customer records with contact info |
| `job` | CRM, Portal | Jobs/appointments with status |
| `invoice` | CRM, Portal | Invoices with payment status |
| `service` | Website | Service offerings |
| `page` | Website | Website pages and content |
| `article` | Website | Blog posts and articles |

### Platform-Specific Search

- **CRM**: Search customers, jobs, invoices
- **Portal**: Search customer's own jobs and invoices
- **Website**: Search services, pages, articles

## Architecture

```
┌─────────────────────────────────────────────────────┐
│         Data Sources                                 │
│  - Customers Table                                  │
│  - Jobs Table                                       │
│  - Invoices Table                                   │
│  - Website Pages                                    │
│  - Services                                         │
└──────────────┬──────────────────────────────────────┘
               │
               │ Indexing (on create/update)
               │
               ↓
┌─────────────────────────────────────────────────────┐
│         Search Index Table                           │
│  - entity_type, entity_id                           │
│  - title, description, content                      │
│  - search_vector (TSVECTOR)                         │
│  - platform, tags, metadata                         │
└──────────────┬──────────────────────────────────────┘
               │
               │ Full-Text Search (PostgreSQL)
               │
               ↓
┌─────────────────────────────────────────────────────┐
│         Search API                                   │
│  GET /api/search?q=query                            │
│  - Filters: platform, type, tags                    │
│  - Returns: ranked results grouped by platform      │
└──────────────┬──────────────────────────────────────┘
               │
               │ Display in UI
               │
               ↓
┌─────────────────────────────────────────────────────┐
│         Search Components                            │
│  - GlobalSearch (CRM)                               │
│  - PortalSearch (Customer Portal)                   │
│  - WebsiteSearch (Marketing Site)                   │
└─────────────────────────────────────────────────────┘
```

## Database Schema

### search_index Table

```sql
CREATE TABLE search_index (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,    -- Type of entity
  entity_id VARCHAR(255) NOT NULL,     -- ID in source table
  title TEXT NOT NULL,                 -- Display title
  description TEXT,                    -- Short description
  content TEXT,                        -- Full content
  url TEXT NOT NULL,                   -- Link to entity
  platform VARCHAR(20) NOT NULL,       -- crm|portal|website
  tags TEXT[],                         -- Searchable tags
  search_vector TSVECTOR,              -- Auto-generated search vector
  metadata JSONB,                      -- Additional data
  created_at TIMESTAMP,
  updated_at TIMESTAMP,

  UNIQUE(entity_type, entity_id, platform)
);
```

### Indexes

```sql
-- Full-text search (GIN index for TSVECTOR)
CREATE INDEX idx_search_vector ON search_index USING GIN(search_vector);

-- Entity lookup
CREATE INDEX idx_search_entity ON search_index(entity_type, entity_id);

-- Platform filtering
CREATE INDEX idx_search_platform ON search_index(platform);

-- Tags filtering
CREATE INDEX idx_search_tags ON search_index USING GIN(tags);
```

### Search Vector

The `search_vector` column is automatically generated from title, description, and content with different weights:

```sql
search_vector =
  setweight(to_tsvector('english', title), 'A') ||        -- Highest priority
  setweight(to_tsvector('english', description), 'B') ||  -- Medium priority
  setweight(to_tsvector('english', content), 'C') ||      -- Lower priority
  setweight(to_tsvector('english', tags), 'D')            -- Lowest priority
```

## Indexing System

### Auto-Indexing

Entities are automatically indexed when created or updated:

```typescript
// After creating a customer
await indexCustomer(customer.id);

// After creating a job
await indexJob(job.id);

// After creating an invoice
await indexInvoice(invoice.id);
```

### Manual Indexing

You can manually trigger indexing for specific entities:

```typescript
import { indexCustomer, indexJob, indexInvoice } from '@/lib/search/indexer';

// Index a customer
await indexCustomer('customer-id');

// Index a job (creates entries for both CRM and Portal)
await indexJob('job-id');

// Index an invoice
await indexInvoice('invoice-id');
```

### Bulk Reindexing

Use the cron job to reindex all entities:

```bash
# Reindex everything
curl -X POST https://crm.dirtfreecarpet.com/api/cron/reindex-search \
  -H "Authorization: Bearer $CRON_SECRET"

# Reindex only customers
curl -X POST "https://crm.dirtfreecarpet.com/api/cron/reindex-search?type=customer" \
  -H "Authorization: Bearer $CRON_SECRET"

# Reindex with custom limit
curl -X POST "https://crm.dirtfreecarpet.com/api/cron/reindex-search?limit=500" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Customer Indexing

```typescript
// Customer indexed for CRM
{
  entity_type: 'customer',
  entity_id: 'customer-id',
  title: 'John Doe',
  description: 'john@example.com • (713) 555-0100',
  content: '123 Main St Houston TX 77001',
  url: '/dashboard/customers/customer-id',
  platform: 'crm',
  tags: ['houston', 'tx', 'website', 'active'],
  metadata: {
    email: 'john@example.com',
    phone: '(713) 555-0100',
    totalJobs: 5,
    lifetimeValue: 1250
  }
}
```

### Job Indexing

```typescript
// Job indexed for CRM
{
  entity_type: 'job',
  entity_id: 'job-id',
  title: 'Carpet Cleaning - John Doe',
  description: 'Status: Confirmed • Date: 1/15/2025 • Zone: North',
  content: 'Customer notes and special instructions',
  url: '/dashboard/jobs/job-id',
  platform: 'crm',
  tags: ['confirmed', 'carpet_cleaning', 'north', 'houston'],
  metadata: {
    customerName: 'John Doe',
    customerId: 'customer-id',
    status: 'confirmed',
    scheduledDate: '2025-01-15'
  }
}

// Same job indexed for Portal (if customer has portal access)
{
  entity_type: 'job',
  entity_id: 'job-id',
  title: 'Carpet Cleaning Appointment',
  description: 'Scheduled for January 15, 2025',
  url: '/dashboard/appointments/job-id',
  platform: 'portal',
  tags: ['confirmed', 'carpet_cleaning'],
  metadata: {
    status: 'confirmed',
    scheduledDate: '2025-01-15'
  }
}
```

## Search API

### GET /api/search

Search across all platforms or filter by platform and entity type.

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `q` | string | Search query (required, min 2 chars) | `carpet` |
| `platform` | string | Filter by platform (crm\|portal\|website\|all) | `crm` |
| `type` | string | Filter by entity type | `customer` |
| `limit` | number | Max results (default: 20, max: 100) | `10` |
| `tags` | string | Filter by tags (comma-separated) | `houston,active` |

**Examples:**

```bash
# Search for "carpet cleaning"
GET /api/search?q=carpet+cleaning

# Search customers in CRM
GET /api/search?q=john&platform=crm&type=customer

# Search jobs with specific tags
GET /api/search?q=appointment&tags=confirmed,houston

# Limit results
GET /api/search?q=invoice&limit=5
```

**Response:**

```json
{
  "success": true,
  "query": "carpet cleaning",
  "platform": "all",
  "total": 15,
  "results": [
    {
      "id": "uuid",
      "entity_type": "job",
      "entity_id": "job-id",
      "title": "Carpet Cleaning - John Doe",
      "description": "Status: Confirmed • Date: 1/15/2025",
      "url": "/dashboard/jobs/job-id",
      "platform": "crm",
      "tags": ["confirmed", "carpet_cleaning"],
      "metadata": {...}
    },
    // ... more results
  ],
  "grouped": {
    "crm": [...],
    "portal": [...],
    "website": [...]
  },
  "stats": {
    "total": 15,
    "byPlatform": {
      "crm": 8,
      "portal": 3,
      "website": 4
    },
    "byEntityType": {
      "customer": 3,
      "job": 8,
      "service": 4
    }
  }
}
```

## Components

### GlobalSearch (CRM)

**Location**: `/dirt-free-crm/src/components/GlobalSearch.tsx`

Full-featured search component with keyboard shortcuts and result navigation.

**Usage:**

```tsx
import { GlobalSearch } from '@/components/GlobalSearch';

export function Header() {
  return (
    <header>
      <nav>
        <GlobalSearch />
      </nav>
    </header>
  );
}
```

**Features:**

- Debounced search (300ms delay)
- Keyboard shortcut (Cmd/Ctrl + K)
- Arrow key navigation
- Visual result highlighting
- Entity type icons and colors
- Tag display
- Responsive dropdown

**Keyboard Shortcuts:**

- `Cmd/Ctrl + K`: Focus search
- `↑ ↓`: Navigate results
- `Enter`: Open selected result
- `Esc`: Close search

### useDebounce Hook

**Location**: `/dirt-free-crm/src/hooks/useDebounce.ts`

Debounces a value to reduce API calls.

**Usage:**

```typescript
import { useDebounce } from '@/hooks/useDebounce';

function SearchComponent() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) {
      performSearch(debouncedQuery);
    }
  }, [debouncedQuery]);
}
```

## Setup Instructions

### 1. Run Database Migration

```bash
cd dirt-free-crm
npx supabase migration up
```

This creates the `search_index` table and all necessary functions.

### 2. Set Environment Variables

Add to `.env.local`:

```bash
# Cron job secret for reindexing
CRON_SECRET=your-secure-random-secret-key
```

### 3. Add GlobalSearch to CRM Header

```tsx
// In your CRM header component
import { GlobalSearch } from '@/components/GlobalSearch';

export function DashboardHeader() {
  return (
    <header>
      <nav className="flex items-center gap-4">
        <Logo />
        <GlobalSearch />
        <UserMenu />
      </nav>
    </header>
  );
}
```

### 4. Add Auto-Indexing to API Routes

Update your create/update API routes to trigger indexing:

```typescript
// In customer API route
import { indexCustomer } from '@/lib/search/indexer';

export async function POST(req: Request) {
  // Create customer
  const { data: customer } = await supabase
    .from('customers')
    .insert(customerData)
    .select()
    .single();

  // Index for search
  await indexCustomer(customer.id);

  return Response.json({ success: true, customer });
}
```

### 5. Schedule Reindex Cron Job

**Using Vercel Cron:**

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/reindex-search",
      "schedule": "0 0 * * 0"
    }
  ]
}
```

**Using external cron:**

```bash
# Weekly on Sunday at midnight
0 0 * * 0 curl -X POST https://crm.dirtfreecarpet.com/api/cron/reindex-search \
  -H "Authorization: Bearer $CRON_SECRET"
```

### 6. Initial Reindex

Trigger an initial reindex to populate the search index:

```bash
curl -X POST https://crm.dirtfreecarpet.com/api/cron/reindex-search \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Usage Examples

### Example 1: Search for Customers

```typescript
// Search for customers by name or email
const results = await fetch('/api/search?q=john&platform=crm&type=customer');
```

### Example 2: Search Jobs by Service Type

```typescript
// Search carpet cleaning jobs
const results = await fetch('/api/search?q=carpet&type=job');
```

### Example 3: Search with Tags

```typescript
// Search confirmed jobs in Houston
const results = await fetch('/api/search?q=appointment&tags=confirmed,houston');
```

### Example 4: Website Service Search

```typescript
// Search services on website
const results = await fetch('/api/search?q=tile+grout&platform=website&type=service');
```

## Best Practices

### 1. Index Immediately After Create/Update

```typescript
// ✅ Good: Index right after creation
const { data: customer } = await supabase.from('customers').insert(data).single();
await indexCustomer(customer.id);

// ❌ Bad: Forget to index
const { data: customer } = await supabase.from('customers').insert(data).single();
// Customer won't appear in search!
```

### 2. Use Weighted Fields

Put the most important information in the title:

```typescript
// ✅ Good: Important info in title
title: 'Carpet Cleaning - John Doe',
description: 'Scheduled for 1/15/2025',
content: 'Additional notes...'

// ❌ Bad: Important info buried in content
title: 'Job',
description: '',
content: 'Carpet cleaning for John Doe on 1/15/2025'
```

### 3. Add Relevant Tags

```typescript
// ✅ Good: Useful, searchable tags
tags: ['houston', 'tx', 'carpet_cleaning', 'confirmed']

// ❌ Bad: Useless tags
tags: ['tag1', 'tag2']
```

### 4. Include Useful Metadata

```typescript
// ✅ Good: Metadata for filtering and display
metadata: {
  customerEmail: 'john@example.com',
  status: 'confirmed',
  totalAmount: 250
}

// ❌ Bad: Empty metadata
metadata: {}
```

### 5. Delete Index When Deleting Entity

```typescript
// ✅ Good: Clean up search index
await supabase.from('customers').delete().eq('id', customerId);
await deleteSearchIndex('customer', customerId);

// ❌ Bad: Orphaned search entries
await supabase.from('customers').delete().eq('id', customerId);
// Search still returns deleted customer!
```

## Troubleshooting

### Search Returns No Results

**Symptoms**: Search query returns empty results even though entities exist

**Causes:**
1. Search index not populated
2. Entities not indexed
3. Search query too short (< 2 chars)

**Solutions:**

```bash
# Check if search index has data
SELECT COUNT(*) FROM search_index;

# Trigger reindex
curl -X POST https://crm.dirtfreecarpet.com/api/cron/reindex-search \
  -H "Authorization: Bearer $CRON_SECRET"

# Check specific entity
SELECT * FROM search_index WHERE entity_id = 'your-entity-id';
```

### Search Returns Irrelevant Results

**Symptoms**: Search results don't match query well

**Causes:**
1. Poor title/description/content
2. Missing tags
3. Incorrect weight distribution

**Solutions:**

```typescript
// Improve title quality
// ❌ Bad
title: 'Job'

// ✅ Good
title: 'Carpet Cleaning - John Doe - Houston'

// Add relevant tags
tags: ['carpet_cleaning', 'houston', 'tx', 'residential']

// Use metadata for additional context
metadata: {
  serviceType: 'carpet_cleaning',
  location: 'Houston, TX'
}
```

### Slow Search Performance

**Symptoms**: Search takes > 500ms to return results

**Causes:**
1. Missing indexes
2. Large result set
3. Complex queries

**Solutions:**

```sql
-- Verify indexes exist
\d+ search_index

-- Add missing index
CREATE INDEX IF NOT EXISTS idx_search_vector
  ON search_index USING GIN(search_vector);

-- Limit results
GET /api/search?q=query&limit=10

-- Use platform filter
GET /api/search?q=query&platform=crm
```

### Stale Search Results

**Symptoms**: Search shows old data after update

**Causes:**
1. Update didn't trigger reindex
2. Caching issue

**Solutions:**

```typescript
// Always reindex after update
await supabase.from('customers').update(data).eq('id', customerId);
await indexCustomer(customerId);  // Don't forget!

// Force reindex if needed
await deleteSearchIndex('customer', customerId);
await indexCustomer(customerId);
```

## SQL Helper Queries

### Check Index Status

```sql
-- Get count by platform
SELECT platform, COUNT(*)
FROM search_index
GROUP BY platform;

-- Get count by entity type
SELECT entity_type, COUNT(*)
FROM search_index
GROUP BY entity_type;

-- Recent additions
SELECT entity_type, title, platform, created_at
FROM search_index
ORDER BY created_at DESC
LIMIT 10;
```

### Search Debugging

```sql
-- Test search vector
SELECT
  title,
  description,
  ts_rank(search_vector, websearch_to_tsquery('english', 'carpet')) as rank
FROM search_index
WHERE search_vector @@ websearch_to_tsquery('english', 'carpet')
ORDER BY rank DESC
LIMIT 10;

-- Find entities not indexed
SELECT c.id, c.first_name, c.last_name
FROM customers c
LEFT JOIN search_index si ON si.entity_id = c.id AND si.entity_type = 'customer'
WHERE si.id IS NULL;
```

### Clean Up Orphaned Entries

```sql
-- Find orphaned customer entries
SELECT si.*
FROM search_index si
LEFT JOIN customers c ON c.id = si.entity_id
WHERE si.entity_type = 'customer' AND c.id IS NULL;

-- Delete orphaned entries
DELETE FROM search_index si
USING (
  SELECT si.id
  FROM search_index si
  LEFT JOIN customers c ON c.id = si.entity_id
  WHERE si.entity_type = 'customer' AND c.id IS NULL
) orphaned
WHERE si.id = orphaned.id;
```

## Related Documentation

- [Website Analytics](./WEBSITE_ANALYTICS.md)
- [Portal Provisioning](./PORTAL_PROVISIONING.md)
- [Real-Time Sync](../dirt-free-customer-portal/REALTIME_SYNC.md)

## Support

For questions or issues:
- Check PostgreSQL full-text search documentation
- Verify indexes are created correctly
- Test search queries directly in database
- Review this documentation for solutions
- Contact development team for assistance
