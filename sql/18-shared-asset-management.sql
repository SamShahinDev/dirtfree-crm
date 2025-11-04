-- =====================================================
-- SHARED ASSET MANAGEMENT SYSTEM
-- Creates centralized asset management for logos, documents,
-- and media accessible across all platforms (CRM, Portal, Website)
-- =====================================================

-- 1. CREATE SHARED ASSETS TABLE
CREATE TABLE IF NOT EXISTS shared_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_type VARCHAR(50) NOT NULL, -- 'logo', 'image', 'document', 'template', 'video'
  category VARCHAR(100), -- 'branding', 'marketing', 'legal', 'operations'
  name VARCHAR(255) NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  dimensions JSONB, -- {width, height} for images/videos

  -- Access control
  platforms TEXT[] DEFAULT ARRAY['crm', 'portal', 'website'], -- Which platforms can access
  is_public BOOLEAN DEFAULT false,

  -- Versioning
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES shared_assets(id),

  -- Metadata
  tags TEXT[],
  metadata JSONB,

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,

  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shared_assets_type ON shared_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_shared_assets_category ON shared_assets(category);
CREATE INDEX IF NOT EXISTS idx_shared_assets_platforms ON shared_assets USING GIN(platforms);
CREATE INDEX IF NOT EXISTS idx_shared_assets_tags ON shared_assets USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_shared_assets_created_at ON shared_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_assets_usage ON shared_assets(usage_count DESC, last_used_at DESC);

-- Add comments for documentation
COMMENT ON TABLE shared_assets IS 'Centralized asset management system for all platforms';
COMMENT ON COLUMN shared_assets.platforms IS 'Array of platforms that can access this asset';
COMMENT ON COLUMN shared_assets.dimensions IS 'JSON object with width and height for images/videos';
COMMENT ON COLUMN shared_assets.metadata IS 'Additional metadata like brand colors, file attributes, etc.';

-- 2. CREATE ASSET CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS asset_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed predefined asset categories
INSERT INTO asset_categories (name, description, icon, sort_order) VALUES
  ('branding', 'Company logos, colors, fonts, brand guidelines', 'palette', 1),
  ('marketing', 'Marketing materials, advertisements, campaigns', 'megaphone', 2),
  ('legal', 'Contracts, terms of service, privacy policies', 'file-text', 3),
  ('operations', 'Process documents, forms, checklists', 'settings', 4),
  ('training', 'Training materials, videos, guides, manuals', 'graduation-cap', 5),
  ('templates', 'Email templates, document templates', 'file-template', 6)
ON CONFLICT (name) DO NOTHING;

-- 3. CREATE STORAGE BUCKET FOR SHARED ASSETS
-- Note: This needs to be run in Supabase Dashboard or via Supabase CLI
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'shared-assets',
--   'shared-assets',
--   true,
--   52428800, -- 50MB limit
--   ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
--         'application/pdf', 'video/mp4', 'video/webm',
--         'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
--         'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
-- );

-- 4. ROW LEVEL SECURITY POLICIES
ALTER TABLE shared_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all assets
CREATE POLICY "Authenticated users can view shared assets"
  ON shared_assets FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can insert assets
CREATE POLICY "Admins can insert shared assets"
  ON shared_assets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Only admins can update assets
CREATE POLICY "Admins can update shared assets"
  ON shared_assets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Only admins can delete assets
CREATE POLICY "Admins can delete shared assets"
  ON shared_assets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Everyone can view asset categories
CREATE POLICY "Anyone can view asset categories"
  ON asset_categories FOR SELECT
  USING (true);

-- 5. STORAGE POLICIES
-- Note: Run these in Supabase Dashboard Storage Settings
-- Storage policies for shared-assets bucket:

-- CREATE POLICY "Anyone can view public assets"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'shared-assets' AND (storage.foldername(name))[1] = 'public');

-- CREATE POLICY "Authenticated users can view all assets"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'shared-assets' AND auth.role() = 'authenticated');

-- CREATE POLICY "Admins can upload assets"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'shared-assets' AND
--     auth.role() = 'authenticated' AND
--     EXISTS (
--       SELECT 1 FROM users
--       WHERE users.id = auth.uid()
--       AND users.role IN ('admin', 'manager')
--     )
--   );

-- CREATE POLICY "Admins can update assets"
--   ON storage.objects FOR UPDATE
--   USING (
--     bucket_id = 'shared-assets' AND
--     auth.role() = 'authenticated' AND
--     EXISTS (
--       SELECT 1 FROM users
--       WHERE users.id = auth.uid()
--       AND users.role IN ('admin', 'manager')
--     )
--   );

-- CREATE POLICY "Admins can delete assets"
--   ON storage.objects FOR DELETE
--   USING (
--     bucket_id = 'shared-assets' AND
--     auth.role() = 'authenticated' AND
--     EXISTS (
--       SELECT 1 FROM users
--       WHERE users.id = auth.uid()
--       AND users.role IN ('admin', 'manager')
--     )
--   );

-- 6. CREATE UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_shared_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_shared_assets_updated_at
  BEFORE UPDATE ON shared_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_shared_assets_updated_at();

CREATE TRIGGER trigger_asset_categories_updated_at
  BEFORE UPDATE ON asset_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_shared_assets_updated_at();

-- 7. CREATE AUDIT LOG TRIGGER FOR ASSET OPERATIONS
CREATE OR REPLACE FUNCTION log_asset_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details
    ) VALUES (
      auth.uid(),
      'asset_deleted',
      'shared_asset',
      OLD.id,
      jsonb_build_object(
        'name', OLD.name,
        'asset_type', OLD.asset_type,
        'category', OLD.category
      )
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details
    ) VALUES (
      auth.uid(),
      'asset_updated',
      'shared_asset',
      NEW.id,
      jsonb_build_object(
        'name', NEW.name,
        'changes', jsonb_build_object(
          'name', CASE WHEN OLD.name != NEW.name THEN jsonb_build_object('old', OLD.name, 'new', NEW.name) ELSE NULL END,
          'category', CASE WHEN OLD.category != NEW.category THEN jsonb_build_object('old', OLD.category, 'new', NEW.category) ELSE NULL END
        )
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      details
    ) VALUES (
      auth.uid(),
      'asset_created',
      'shared_asset',
      NEW.id,
      jsonb_build_object(
        'name', NEW.name,
        'asset_type', NEW.asset_type,
        'category', NEW.category
      )
    );
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_asset_changes
  AFTER INSERT OR UPDATE OR DELETE ON shared_assets
  FOR EACH ROW
  EXECUTE FUNCTION log_asset_changes();

-- 8. CREATE HELPER FUNCTIONS

-- Function to get assets by platform
CREATE OR REPLACE FUNCTION get_assets_by_platform(platform_name TEXT)
RETURNS TABLE (
  id UUID,
  asset_type VARCHAR,
  category VARCHAR,
  name VARCHAR,
  description TEXT,
  file_url TEXT,
  dimensions JSONB,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.asset_type,
    sa.category,
    sa.name,
    sa.description,
    sa.file_url,
    sa.dimensions,
    sa.tags,
    sa.created_at
  FROM shared_assets sa
  WHERE platform_name = ANY(sa.platforms)
  ORDER BY sa.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track asset usage
CREATE OR REPLACE FUNCTION track_asset_usage(asset_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE shared_assets
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = asset_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT ON shared_assets TO authenticated;
GRANT SELECT ON asset_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON shared_assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON asset_categories TO service_role;

-- =====================================================
-- NOTES FOR MANUAL SETUP
-- =====================================================

-- IMPORTANT: The following need to be done manually in Supabase Dashboard:
--
-- 1. Create Storage Bucket:
--    - Go to Storage section
--    - Create new bucket named "shared-assets"
--    - Set as Public
--    - Configure allowed MIME types and file size limits
--
-- 2. Apply Storage Policies:
--    - Use the commented storage policies above
--    - Apply them in the Storage > Policies section
--
-- 3. Test the setup:
--    - Try uploading a test asset
--    - Verify RLS policies are working correctly
--    - Check that assets are accessible from all platforms
