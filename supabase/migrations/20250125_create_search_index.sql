-- Cross-Platform Search Index
-- Unified search across Website, CRM, and Portal

-- ============================================================================
-- Table: search_index
-- Centralized search index for all platforms
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_index (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(50) NOT NULL,  -- 'customer', 'job', 'invoice', 'service', 'page'
  entity_id VARCHAR(255) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  url TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL,     -- 'crm', 'portal', 'website'
  tags TEXT[],
  search_vector TSVECTOR,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint per entity across platforms
  UNIQUE(entity_type, entity_id, platform)
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Full-text search index (GIN for TSVECTOR)
CREATE INDEX IF NOT EXISTS idx_search_vector
  ON search_index USING GIN(search_vector);

-- Entity lookup index
CREATE INDEX IF NOT EXISTS idx_search_entity
  ON search_index(entity_type, entity_id);

-- Platform filter index
CREATE INDEX IF NOT EXISTS idx_search_platform
  ON search_index(platform);

-- Combined platform + entity type for filtered searches
CREATE INDEX IF NOT EXISTS idx_search_platform_entity
  ON search_index(platform, entity_type);

-- Tags index for tag-based filtering
CREATE INDEX IF NOT EXISTS idx_search_tags
  ON search_index USING GIN(tags);

-- Updated_at for cache invalidation
CREATE INDEX IF NOT EXISTS idx_search_updated
  ON search_index(updated_at DESC);

-- ============================================================================
-- Functions
-- ============================================================================

/**
 * Function to automatically update search_vector on insert/update
 * Uses weighted text search:
 * - Title: Weight A (highest priority)
 * - Description: Weight B (medium priority)
 * - Content: Weight C (lower priority)
 */
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'D');

  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update search vector before insert/update
CREATE TRIGGER search_index_vector_update
  BEFORE INSERT OR UPDATE ON search_index
  FOR EACH ROW
  EXECUTE FUNCTION update_search_vector();

-- ============================================================================
-- Search Functions
-- ============================================================================

/**
 * Search function with ranking
 * Returns search results sorted by relevance
 */
CREATE OR REPLACE FUNCTION search_all(
  search_query TEXT,
  search_platform VARCHAR(20) DEFAULT NULL,
  search_entity_type VARCHAR(50) DEFAULT NULL,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  entity_type VARCHAR(50),
  entity_id VARCHAR(255),
  title TEXT,
  description TEXT,
  url TEXT,
  platform VARCHAR(20),
  tags TEXT[],
  metadata JSONB,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    si.entity_type,
    si.entity_id,
    si.title,
    si.description,
    si.url,
    si.platform,
    si.tags,
    si.metadata,
    ts_rank(si.search_vector, websearch_to_tsquery('english', search_query)) AS rank
  FROM search_index si
  WHERE si.search_vector @@ websearch_to_tsquery('english', search_query)
    AND (search_platform IS NULL OR si.platform = search_platform)
    AND (search_entity_type IS NULL OR si.entity_type = search_entity_type)
  ORDER BY rank DESC, si.updated_at DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

/**
 * Get search suggestions (autocomplete)
 * Returns titles that start with the query
 */
CREATE OR REPLACE FUNCTION search_suggestions(
  search_query TEXT,
  search_platform VARCHAR(20) DEFAULT NULL,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  title TEXT,
  entity_type VARCHAR(50),
  platform VARCHAR(20),
  url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    si.title,
    si.entity_type,
    si.platform,
    si.url
  FROM search_index si
  WHERE si.title ILIKE search_query || '%'
    AND (search_platform IS NULL OR si.platform = search_platform)
  ORDER BY si.title
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

/**
 * Get search statistics
 * Returns counts by platform and entity type
 */
CREATE OR REPLACE FUNCTION search_stats()
RETURNS TABLE (
  platform VARCHAR(20),
  entity_type VARCHAR(50),
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.platform,
    si.entity_type,
    COUNT(*) as count
  FROM search_index si
  GROUP BY si.platform, si.entity_type
  ORDER BY si.platform, si.entity_type;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Helper Functions for Indexing
-- ============================================================================

/**
 * Upsert search index entry
 * Convenience function to insert or update search index
 */
CREATE OR REPLACE FUNCTION upsert_search_index(
  p_entity_type VARCHAR(50),
  p_entity_id VARCHAR(255),
  p_title TEXT,
  p_description TEXT,
  p_content TEXT,
  p_url TEXT,
  p_platform VARCHAR(20),
  p_tags TEXT[],
  p_metadata JSONB
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO search_index (
    entity_type,
    entity_id,
    title,
    description,
    content,
    url,
    platform,
    tags,
    metadata
  ) VALUES (
    p_entity_type,
    p_entity_id,
    p_title,
    p_description,
    p_content,
    p_url,
    p_platform,
    p_tags,
    p_metadata
  )
  ON CONFLICT (entity_type, entity_id, platform)
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    content = EXCLUDED.content,
    url = EXCLUDED.url,
    tags = EXCLUDED.tags,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Delete search index entries for an entity
 */
CREATE OR REPLACE FUNCTION delete_search_index_entity(
  p_entity_type VARCHAR(50),
  p_entity_id VARCHAR(255)
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM search_index
  WHERE entity_type = p_entity_type
    AND entity_id = p_entity_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE search_index IS 'Centralized search index for all platforms (CRM, Portal, Website)';
COMMENT ON COLUMN search_index.entity_type IS 'Type of entity: customer, job, invoice, service, page, article';
COMMENT ON COLUMN search_index.entity_id IS 'ID of the entity in its source table';
COMMENT ON COLUMN search_index.platform IS 'Platform where this entity is searchable: crm, portal, website';
COMMENT ON COLUMN search_index.search_vector IS 'Full-text search vector (auto-generated)';
COMMENT ON COLUMN search_index.metadata IS 'Additional searchable metadata stored as JSON';
COMMENT ON COLUMN search_index.tags IS 'Array of tags for filtering and categorization';
