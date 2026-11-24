-- Run this script in your Supabase SQL Editor (User DB)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS latest_sat_rw INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS latest_sat_math INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS first_mock_sat_rw INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS first_mock_sat_math INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS weak_topics TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS admin_level INTEGER DEFAULT 1 NOT NULL,
ADD COLUMN IF NOT EXISTS user_level INTEGER DEFAULT 1 NOT NULL,
ADD COLUMN IF NOT EXISTS question_attempts JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS has_claimed_practice_promo BOOLEAN DEFAULT FALSE;

-- Classes Package Table (User DB)
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL DEFAULT 'General',
  duration TEXT DEFAULT '1h 00m',
  is_free BOOLEAN DEFAULT true,
  required_level INTEGER DEFAULT 1 NOT NULL,
  video_id TEXT DEFAULT NULL,
  thumbnail_url TEXT,
  parent_directory TEXT DEFAULT '/root/classes',
  recordings JSONB DEFAULT '[]'::jsonb,
  resources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS class_recordings_video_id_key;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO service_role;
GRANT SELECT ON public.classes TO authenticated;

CREATE POLICY "Anyone can view classes" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Admins can manage classes" ON public.classes FOR ALL USING (public.is_admin());

-- Admin Tool Permissions Table (Owner Control Room)
CREATE TABLE IF NOT EXISTS public.admin_tool_permissions (
  tool_id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  min_admin_level INTEGER DEFAULT 8 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_tool_permissions ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_tool_permissions (tool_id, tool_name, min_admin_level)
VALUES 
  ('view_stats', '📈 View Platform Analytics & Revenue Stats', 8),
  ('manage_users', '👥 Manage Student Profiles & Roles', 8),
  ('create_content', '✍️ Create & Edit Questions / Modules', 7),
  ('delete_content', '🗑️ Delete Practice Content / Classes', 8),
  ('owner_room', '🔒 Access Owner Command Room', 9),
  ('scheduled-upgrades', '✨ Bulk Scheduled Auto-Trigger Upgrades', 7)
ON CONFLICT (tool_id) DO NOTHING;

-- Site Feature Toggles Table (Website Maintenance Switches)
CREATE TABLE IF NOT EXISTS public.site_feature_toggles (
  feature_id TEXT PRIMARY KEY,
  feature_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  maintenance_message TEXT DEFAULT 'We are currently upgrading this section to bring you a better learning experience. Please check back shortly!',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.site_feature_toggles ENABLE ROW LEVEL SECURITY;

INSERT INTO public.site_feature_toggles (feature_id, feature_name, is_enabled)
VALUES 
  ('classes', '📚 Class Packages & Masterclasses', true),
  ('modules', '📖 Standalone Practice Modules', true),
  ('practice-tests', '🎓 Full-Length Practice Tests', true),
  ('practice', '⚡ Custom Practice Mode', true),
  ('history', '📊 History & Review Analytics', true)
ON CONFLICT (feature_id) DO NOTHING;

-- Scheduled Auto-Trigger Upgrades Table
CREATE TABLE IF NOT EXISTS scheduled_upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  target_level INT NOT NULL DEFAULT 6,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_upgrades_email ON scheduled_upgrades(email);
ALTER TABLE scheduled_upgrades ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4-TIER COLUMNAR ANALYTICS & TELEMETRY ENGINE (USER DB - PROJECT A)
-- ============================================================================

-- 1. Create Daily Delta Ledger Table for Freeze-Point Sliding Window Rollups
CREATE TABLE IF NOT EXISTS public.analytics_daily_deltas (
  target_date DATE DEFAULT CURRENT_DATE,
  table_name TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  delta_value BIGINT DEFAULT 0,
  PRIMARY KEY (target_date, table_name, reference_id, metric_name)
);

ALTER TABLE public.analytics_daily_deltas ENABLE ROW LEVEL SECURITY;

-- 2. Add 32 category/window tracking columns to classes table
ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS free_clicks_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_clicks_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_clicks_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_clicks_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_seconds_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_seconds_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_seconds_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_seconds_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS practice_clicks_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_clicks_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_clicks_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_clicks_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS practice_seconds_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_seconds_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_seconds_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_seconds_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS flash_clicks_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_clicks_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_clicks_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_clicks_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS flash_seconds_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_seconds_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_seconds_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_seconds_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS master_clicks_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_clicks_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_clicks_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_clicks_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS master_seconds_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_seconds_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_seconds_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_seconds_all BIGINT DEFAULT 0;

-- 3. Create dedicated Page Traffic Analytics Table (General Routes) with 32 columns
CREATE TABLE IF NOT EXISTS public.page_traffic_analytics (
  route_path TEXT PRIMARY KEY,
  free_visits_7d BIGINT DEFAULT 0, free_visits_14d BIGINT DEFAULT 0, free_visits_30d BIGINT DEFAULT 0, free_visits_all BIGINT DEFAULT 0,
  free_seconds_7d BIGINT DEFAULT 0, free_seconds_14d BIGINT DEFAULT 0, free_seconds_30d BIGINT DEFAULT 0, free_seconds_all BIGINT DEFAULT 0,
  practice_visits_7d BIGINT DEFAULT 0, practice_visits_14d BIGINT DEFAULT 0, practice_visits_30d BIGINT DEFAULT 0, practice_visits_all BIGINT DEFAULT 0,
  practice_seconds_7d BIGINT DEFAULT 0, practice_seconds_14d BIGINT DEFAULT 0, practice_seconds_30d BIGINT DEFAULT 0, practice_seconds_all BIGINT DEFAULT 0,
  flash_visits_7d BIGINT DEFAULT 0, flash_visits_14d BIGINT DEFAULT 0, flash_visits_30d BIGINT DEFAULT 0, flash_visits_all BIGINT DEFAULT 0,
  flash_seconds_7d BIGINT DEFAULT 0, flash_seconds_14d BIGINT DEFAULT 0, flash_seconds_30d BIGINT DEFAULT 0, flash_seconds_all BIGINT DEFAULT 0,
  master_visits_7d BIGINT DEFAULT 0, master_visits_14d BIGINT DEFAULT 0, master_visits_30d BIGINT DEFAULT 0, master_visits_all BIGINT DEFAULT 0,
  master_seconds_7d BIGINT DEFAULT 0, master_seconds_14d BIGINT DEFAULT 0, master_seconds_30d BIGINT DEFAULT 0, master_seconds_all BIGINT DEFAULT 0
);

ALTER TABLE public.page_traffic_analytics ENABLE ROW LEVEL SECURITY;

-- Ensure all 16 fixed authoritative route rows exist in page_traffic_analytics
INSERT INTO public.page_traffic_analytics (route_path)
VALUES 
  ('/dashboard'),
  ('/dashboard/practice'),
  ('/dashboard/practice-tests'),
  ('/dashboard/history'),
  ('/dashboard/profile'),
  ('/dashboard/classes'),
  ('/dashboard/modules'),
  ('/test/[id]'),
  ('/quiz/[id]'),
  ('/class/[id]'),
  ('/admin/analytics'),
  ('/admin/classes'),
  ('/admin/users'),
  ('/upgrade'),
  ('/login'),
  ('/signup')
ON CONFLICT (route_path) DO NOTHING;

-- 4. Create active sessions table for real-time online count pulse
CREATE TABLE IF NOT EXISTS public.telemetry_sessions (
  session_token TEXT PRIMARY KEY,
  user_id UUID,
  user_tier TEXT DEFAULT 'free',
  device_type TEXT,
  browser_name TEXT,
  os_name TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.telemetry_sessions ENABLE ROW LEVEL SECURITY;

-- 5. Atomic RPC for User DB incrementing (classes and page_traffic_analytics)
CREATE OR REPLACE FUNCTION increment_userdb_analytics(
  p_table TEXT,
  p_id TEXT,
  p_metric TEXT,
  p_delta BIGINT
) RETURNS VOID AS $$
DECLARE
  v_col_7d TEXT := p_metric || '_7d';
  v_col_14d TEXT := p_metric || '_14d';
  v_col_30d TEXT := p_metric || '_30d';
  v_col_all TEXT := p_metric || '_all';
BEGIN
  IF p_table NOT IN ('classes', 'page_traffic_analytics') THEN
    RAISE EXCEPTION 'Invalid target table for userdb analytics: %', p_table;
  END IF;

  -- Strictly update existing row in page_traffic_analytics or classes
  IF p_table = 'page_traffic_analytics' THEN
    EXECUTE format('UPDATE public.page_traffic_analytics SET %I = COALESCE(%I, 0) + $1, %I = COALESCE(%I, 0) + $1, %I = COALESCE(%I, 0) + $1, %I = COALESCE(%I, 0) + $1 WHERE route_path = $2',
                   v_col_7d, v_col_7d, v_col_14d, v_col_14d, v_col_30d, v_col_30d, v_col_all, v_col_all)
    USING p_delta, p_id;
  ELSE
    EXECUTE format('UPDATE public.classes SET %I = COALESCE(%I, 0) + $1, %I = COALESCE(%I, 0) + $1, %I = COALESCE(%I, 0) + $1, %I = COALESCE(%I, 0) + $1 WHERE id = $2',
                   v_col_7d, v_col_7d, v_col_14d, v_col_14d, v_col_30d, v_col_30d, v_col_all, v_col_all)
    USING p_delta, p_id::UUID;
  END IF;

  INSERT INTO public.analytics_daily_deltas (target_date, table_name, reference_id, metric_name, delta_value)
  VALUES (CURRENT_DATE, p_table, p_id, p_metric, p_delta)
  ON CONFLICT (target_date, table_name, reference_id, metric_name)
  DO UPDATE SET delta_value = analytics_daily_deltas.delta_value + p_delta;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Prune Function for Freeze-Point Sliding Window Rollups
CREATE OR REPLACE FUNCTION prune_userdb_daily_deltas() RETURNS VOID AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM public.analytics_daily_deltas WHERE target_date = CURRENT_DATE - 8 LOOP
    IF r.table_name = 'classes' THEN
      EXECUTE format('UPDATE public.classes SET %I = GREATEST(COALESCE(%I, 0) - $1, 0) WHERE id = $2', r.metric_name || '_7d', r.metric_name || '_7d') USING r.delta_value, r.reference_id::UUID;
    ELSIF r.table_name = 'page_traffic_analytics' THEN
      EXECUTE format('UPDATE public.page_traffic_analytics SET %I = GREATEST(COALESCE(%I, 0) - $1, 0) WHERE route_path = $2', r.metric_name || '_7d', r.metric_name || '_7d') USING r.delta_value, r.reference_id;
    END IF;
  END LOOP;

  FOR r IN SELECT * FROM public.analytics_daily_deltas WHERE target_date = CURRENT_DATE - 15 LOOP
    IF r.table_name = 'classes' THEN
      EXECUTE format('UPDATE public.classes SET %I = GREATEST(COALESCE(%I, 0) - $1, 0) WHERE id = $2', r.metric_name || '_14d', r.metric_name || '_14d') USING r.delta_value, r.reference_id::UUID;
    ELSIF r.table_name = 'page_traffic_analytics' THEN
      EXECUTE format('UPDATE public.page_traffic_analytics SET %I = GREATEST(COALESCE(%I, 0) - $1, 0) WHERE route_path = $2', r.metric_name || '_14d', r.metric_name || '_14d') USING r.delta_value, r.reference_id;
    END IF;
  END LOOP;

  FOR r IN SELECT * FROM public.analytics_daily_deltas WHERE target_date = CURRENT_DATE - 31 LOOP
    IF r.table_name = 'classes' THEN
      EXECUTE format('UPDATE public.classes SET %I = GREATEST(COALESCE(%I, 0) - $1, 0) WHERE id = $2', r.metric_name || '_30d', r.metric_name || '_30d') USING r.delta_value, r.reference_id::UUID;
    ELSIF r.table_name = 'page_traffic_analytics' THEN
      EXECUTE format('UPDATE public.page_traffic_analytics SET %I = GREATEST(COALESCE(%I, 0) - $1, 0) WHERE route_path = $2', r.metric_name || '_30d', r.metric_name || '_30d') USING r.delta_value, r.reference_id;
    END IF;
  END LOOP;

  DELETE FROM public.analytics_daily_deltas WHERE target_date < CURRENT_DATE - 36;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. BUG REPORTS TABLE (3-Tier Cyberpunk Triage Command Center)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_tier TEXT DEFAULT 'free',
  reporter_email TEXT DEFAULT 'guest@prepnova.edu',
  bug_type TEXT NOT NULL CHECK (bug_type IN ('question', 'class', 'page', 'other')),
  category TEXT NOT NULL,
  description TEXT NOT NULL CHECK (char_length(description) <= 2000),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  current_url TEXT,
  route_path TEXT,
  target_question_id TEXT,
  target_module_id UUID,
  target_test_id UUID,
  question_index INTEGER,
  user_agent TEXT,
  device_info JSONB DEFAULT '{}'::jsonb,
  client_errors JSONB DEFAULT '[]'::jsonb,
  admin_notes TEXT,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_bug_type ON bug_reports(bug_type);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_priority ON bug_reports(priority);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at DESC);

ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users submit bug reports" ON bug_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND COALESCE(user_level, 1) > 0));
CREATE POLICY "Users view own bug reports" ON bug_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins full access bug_reports" ON bug_reports FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND admin_level >= 7));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bug_reports TO service_role;
GRANT SELECT, INSERT ON public.bug_reports TO authenticated;

-- ============================================================================
-- 8. PRACTICE ENGINE CONFIGURATION (User DB)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.practice_config (
  id INT PRIMARY KEY DEFAULT 1,
  allowed_sources JSONB DEFAULT '[]'::jsonb
);

-- Insert the initial settings row (starts off empty, meaning no sources allowed)
INSERT INTO public.practice_config (id, allowed_sources)
VALUES (1, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Security Policies (allow service role full access)
ALTER TABLE public.practice_config ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_config TO service_role;
