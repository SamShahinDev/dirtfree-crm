-- SMS Templates Overrides Table
-- Stores custom overrides for SMS templates without modifying defaults

create table if not exists sms_templates_overrides (
  key text primary key,
  body text not null check (char_length(body) <= 320),
  updated_at timestamptz not null default now()
);

-- Add RLS policies
alter table sms_templates_overrides enable row level security;

-- Only authenticated users can view (admin-only enforced at app level)
create policy "Authenticated users can view template overrides"
  on sms_templates_overrides for select
  using (auth.role() = 'authenticated');

-- Only authenticated users can modify (admin-only enforced at app level)
create policy "Authenticated users can modify template overrides"
  on sms_templates_overrides for all
  using (auth.role() = 'authenticated');

-- Add index for faster lookups
create index if not exists idx_sms_templates_overrides_key on sms_templates_overrides(key);