-- Seed data for initial system setup
-- Phase 1.3: Insert required reference data for testing and development

-- Insert three trucks with reasonable placeholders
-- These are the initial fleet vehicles for the business
insert into trucks (id, number, name, notes) values
  (uuid_generate_v4(), '01', 'Alpha', 'Primary service vehicle for North zone'),
  (uuid_generate_v4(), '02', 'Bravo', 'Primary service vehicle for South zone'),
  (uuid_generate_v4(), '03', 'Charlie', 'Primary service vehicle for Central zone')
on conflict (number) do nothing;

-- Seed basic tool inventory for each truck
-- Common carpet cleaning tools and supplies
with truck_ids as (
  select id, number from trucks where number in ('01', '02', '03')
),
tools as (
  select * from (values
    ('Carpet Cleaner Machine', 1, 1),
    ('Upholstery Tool', 2, 2),
    ('Vacuum Cleaner', 1, 1),
    ('Steam Cleaner', 1, 1),
    ('Cleaning Solution - Carpet', 5, 4),
    ('Cleaning Solution - Upholstery', 3, 2),
    ('Microfiber Cloths', 10, 8),
    ('Drop Cloths', 5, 4),
    ('Hose Assembly', 2, 2),
    ('Extension Cords', 3, 3)
  ) as t(tool_name, min_qty, qty_on_truck)
)
insert into truck_tools (truck_id, tool_name, min_qty, qty_on_truck, calibration_due)
select
  t.id,
  tools.tool_name,
  tools.min_qty,
  tools.qty_on_truck,
  case
    when tools.tool_name like '%Machine%' or tools.tool_name like '%Cleaner%'
    then current_date + interval '6 months'
    else null
  end as calibration_due
from truck_ids t
cross join tools
on conflict do nothing;

-- Insert sample customer data for testing (optional - can be removed for production)
-- These help with initial testing of the application
insert into customers (id, name, phone_e164, email, address_line1, city, state, postal_code, zone, notes) values
  (
    uuid_generate_v4(),
    'Sample Residential Customer',
    '+15551234567',
    'sample@example.com',
    '123 Main Street',
    'Anytown',
    'State',
    '12345',
    'Central',
    'Initial test customer - remove in production'
  ),
  (
    uuid_generate_v4(),
    'Sample Commercial Client',
    '+15559876543',
    'facilities@business.com',
    '456 Business Boulevard',
    'Commerce City',
    'State',
    '54321',
    'N',
    'Test commercial account - remove in production'
  )
on conflict do nothing;

-- Insert reminder types as reference data
-- These help populate the type dropdown and provide examples
insert into reminders (id, type, origin, title, body, scheduled_date, status) values
  (
    uuid_generate_v4(),
    'follow_up',
    'system',
    'Sample Follow-up Reminder',
    'This is an example follow-up reminder. Delete this in production.',
    current_date + interval '7 days',
    'pending'
  ),
  (
    uuid_generate_v4(),
    'truck',
    'system',
    'Sample Truck Maintenance',
    'Example truck maintenance reminder. Delete this in production.',
    current_date + interval '30 days',
    'pending'
  )
on conflict do nothing;

-- Comments for documentation
comment on table trucks is 'Company vehicles: Alpha (01), Bravo (02), Charlie (03) seeded for initial setup';

-- Log the seeding in audit trail
insert into audit_log (action, entity, meta) values
  ('SEED', 'trucks', '{"count": 3, "numbers": ["01", "02", "03"]}'),
  ('SEED', 'truck_tools', '{"tools_per_truck": 10}'),
  ('SEED', 'customers', '{"count": 2, "type": "test_data"}'),
  ('SEED', 'reminders', '{"count": 2, "type": "examples"}')
on conflict do nothing;