-- Initial extensions and shared utility functions
-- Phase 1.3: Initialize required extensions and triggers

-- Enable required extensions (idempotent)
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- Create shared updated_at trigger function
-- This function will be applied to all tables with an updated_at column
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Comment on the function for documentation
comment on function set_updated_at() is 'Trigger function to automatically update updated_at timestamp';