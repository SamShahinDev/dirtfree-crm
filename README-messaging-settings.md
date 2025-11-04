# SMS Messaging Settings Implementation

## Overview

This implementation provides a complete Admin-only Messaging Settings page for authoring and previewing SMS templates with live sample data, database persistence, and comprehensive audit logging.

## Features

- **Admin-only access** via route guard (`requireRole('admin')`)
- **Live template editing** with real-time preview and validation
- **Database persistence** of template overrides (doesn't modify default templates)
- **Comprehensive validation** (≤320 chars, opt-out text, plain text only)
- **Complete audit logging** with before/after values
- **Sample data form** for realistic preview generation
- **Visual feedback** with character counts, validation indicators
- **Mobile-responsive design** with dark mode support

## Routes

- `/settings/messaging` - Admin-only messaging settings page

## Files Created/Modified

### Database Schema
- `sql/sms_templates_overrides.sql` - Database table for template overrides

### Core Templates System
- `src/app/(comms)/templates.ts` - **MODIFIED**: Added `DefaultTemplates` export and server-side `getTemplates()` resolver
- `src/lib/comms/templates-store.ts` - **NEW**: Server-only template store with override management

### Server Actions
- `src/app/(dashboard)/settings/messaging/actions.ts` - **NEW**: Admin actions for template CRUD and preview

### Page & Components
- `src/app/(dashboard)/settings/messaging/page.tsx` - **NEW**: Admin-guarded main page
- `src/app/(dashboard)/settings/messaging/_components/MessagingSettings.tsx` - **NEW**: Main settings component
- `src/app/(dashboard)/settings/messaging/_components/TemplateEditor.tsx` - **NEW**: Template editor with validation
- `src/app/(dashboard)/settings/messaging/_components/SampleDataForm.tsx` - **NEW**: Sample data input form

## Database Schema

```sql
create table if not exists sms_templates_overrides (
  key text primary key,
  body text not null check (char_length(body) <= 320),
  updated_at timestamptz not null default now()
);
```

## Template System Architecture

### Default Templates (`DefaultTemplates`)
- Exported from `src/app/(comms)/templates.ts`
- Contains the original, unmodified template functions
- Used as fallback and for comparison

### Effective Templates (`getTemplates()`)
- Server-side function that merges defaults with database overrides
- Automatically resolves the most current version of each template
- Used by SMS sending system (`/api/sms/send`)

### Override Management
- All customizations stored as raw template strings in `sms_templates_overrides` table
- Simple variable substitution: `{{customerName}}`, `{{company}}`, `{{jobDate}}`, `{{arrivalWindow}}`
- Validation ensures quality and compliance

## Validation Rules

1. **Character Limit**: ≤ 320 characters (SMS standard)
2. **Opt-out Compliance**: Must contain "Reply STOP to opt out" (case-insensitive)
3. **Plain Text Only**: No HTML, markdown, or special characters
4. **ASCII Only**: Standard printable characters only

## Audit Logging

Every template change is logged to `audit_logs` table with:

```typescript
{
  action: 'template_update' | 'template_reset',
  entity: 'sms_template',
  entity_id: templateKey,
  user_id: adminUserId,
  meta: {
    before: previousBody,
    after: newBody,
    character_count: number,
    is_new_override: boolean,
    reset_to_default?: boolean
  }
}
```

## Template Variables

Templates support these variables with automatic formatting:

- `{{customerName}}` - Customer's name (fallback: "valued customer")
- `{{company}}` - Company name (fallback: "Dirt Free Carpet")
- `{{jobDate}}` - Auto-formatted date (e.g., "Fri, Mar 15")
- `{{arrivalWindow}}` - Time window (e.g., "1-3 PM")

## UI Components

### MessagingSettings (Main Component)
- Overview cards showing template statistics
- Tabbed interface for each template type
- Live character counting and validation status
- Integration with editor and sample data forms

### TemplateEditor
- Textarea with real-time validation feedback
- Character counter with color coding
- Live preview generation
- Save/Reset buttons with loading states
- Default template reference for overridden templates

### SampleDataForm
- Form inputs for all template variables
- Dropdown selectors for common values
- Live variable replacement preview
- Date picker with relative options

## Integration with SMS System

The SMS sending system automatically uses effective templates:

```typescript
// In /api/sms/send or similar
import { getTemplates } from '@/app/(comms)/templates'

const templates = await getTemplates()
const message = templates.job_reminder({
  customerName: 'John Smith',
  jobDate: '2024-03-15',
  arrivalWindow: '1-3 PM',
  company: 'Dirt Free Carpet'
})
```

## Security Features

- **Admin-only access** enforced at page and action levels
- **Input validation** prevents malicious content
- **Audit logging** tracks all changes with user attribution
- **No PII logging** in error messages or audit trails
- **RLS policies** on override table

## Responsive Design

- Mobile-first responsive design
- Cards use `rounded-2xl p-5 lg:p-6` styling
- Proper contrast ratios for accessibility
- Dark mode support throughout
- Touch-friendly interface elements

## Error Handling

- Graceful fallback to defaults if override system fails
- User-friendly error messages with toast notifications
- Validation errors prevent invalid saves
- Server errors logged without exposing sensitive data

## Performance Features

- Real-time preview with debounced updates (300ms)
- Efficient template merging with caching
- Minimal database queries with proper indexing
- Client-side validation for immediate feedback

## Usage Instructions

1. **Access**: Navigate to `/settings/messaging` as an admin user
2. **Edit**: Select a template tab and modify the content in the editor
3. **Preview**: Use the sample data form to test different variable values
4. **Validate**: Check validation indicators before saving
5. **Save**: Click "Save Changes" to persist the override
6. **Reset**: Use "Restore Default" to remove customizations

## Maintenance

- Template overrides are stored separately from code
- Default templates can be updated via code deployments
- Audit logs provide complete change history
- Database constraints ensure data integrity
- Regular validation prevents corruption

This implementation provides a production-ready SMS template management system with enterprise-grade features for security, auditing, and reliability.