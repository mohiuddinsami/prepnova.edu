-- ==============================================================================
-- STANDALONE MIGRATION: OWNER CONTROL PANEL & TOOL PERMISSIONS
-- Target Database: NEXT_PUBLIC_SUPABASE_URL (User DB)
-- Description: Creates the admin_tool_permissions table and seeds default tiers.
-- ==============================================================================

-- 1. Create Table
CREATE TABLE IF NOT EXISTS public.admin_tool_permissions (
  tool_id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  min_admin_level INTEGER DEFAULT 7 NOT NULL
);

-- 2. Seed Default Permissions (Requested by Owner)
INSERT INTO public.admin_tool_permissions (tool_id, tool_name, min_admin_level) VALUES
  ('users', 'User Management', 7),
  ('classes', 'Class Packages', 7),
  ('question-bank', 'Question Bank', 8),
  ('module-builder', 'Module Builder', 7),
  ('bulk-uploader', 'Bulk Uploader', 8),
  ('test-builder', 'Test Builder', 7),
  ('directory-manager', 'Directory Manager', 7),
  ('hash-rehash', 'Hash Rehasher', 9)
ON CONFLICT (tool_id) DO UPDATE SET
  tool_name = EXCLUDED.tool_name,
  min_admin_level = EXCLUDED.min_admin_level;

-- 3. Enable Row Level Security
ALTER TABLE public.admin_tool_permissions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read tool permissions
DROP POLICY IF EXISTS "Anyone can read admin tool permissions" ON public.admin_tool_permissions;
CREATE POLICY "Anyone can read admin tool permissions" ON public.admin_tool_permissions
  FOR SELECT TO authenticated USING (true);

-- Allow only Owner (admin_level = 9) to insert/update/delete tool permissions
DROP POLICY IF EXISTS "Only Owners can modify tool permissions" ON public.admin_tool_permissions;
CREATE POLICY "Only Owners can modify tool permissions" ON public.admin_tool_permissions
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND admin_level >= 9
    )
  );

-- Verify completion
DO $$ 
BEGIN 
  RAISE NOTICE 'Standalone Owner Control Permissions Migration Completed Successfully.'; 
END $$;
