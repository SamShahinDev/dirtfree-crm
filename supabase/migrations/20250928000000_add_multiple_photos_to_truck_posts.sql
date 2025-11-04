-- Add support for multiple photos in truck posts
-- This migration adds an image_urls array column to support multiple photos per post

-- Add image_urls column to truck_posts table
ALTER TABLE truck_posts
ADD COLUMN image_urls TEXT[];

-- Add index for image_urls to optimize queries that filter by posts with images
CREATE INDEX IF NOT EXISTS idx_truck_posts_with_images
ON truck_posts(thread_id, created_at DESC)
WHERE image_urls IS NOT NULL AND array_length(image_urls, 1) > 0;

-- Add comment explaining the column
COMMENT ON COLUMN truck_posts.image_urls IS 'Array of image URLs for multiple photos per post (up to 3 photos recommended)';

-- Note: We're keeping the existing photo_key column for backward compatibility
-- New posts should use image_urls, but existing posts with photo_key will continue to work