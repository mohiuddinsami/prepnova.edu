-- Supabase SQL Schema for Prepnova Education (Final Architecture)

-- 1. CLEAN SLATE
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP TRIGGER IF EXISTS on_submission_insert ON public.submissions;
DROP FUNCTION IF EXISTS public.handle_fifo_submissions CASCADE;
DROP FUNCTION IF EXISTS public.is_admin CASCADE;

DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS modules CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 2. PROFILES TABLE (Extension of auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  whatsapp_number TEXT,
  institution TEXT,
  academic_year TEXT,
  avatar_url TEXT,
  
  -- SAT & Mock Scores
  latest_sat_rw INTEGER,
  latest_sat_math INTEGER,
  first_mock_sat_rw INTEGER,
  first_mock_sat_math INTEGER,
  weak_topics TEXT[] DEFAULT '{}',
  
  -- Legal & Consent
  tos_agreed BOOLEAN DEFAULT FALSE,
  tos_agreed_at TIMESTAMPTZ,
  
  -- Security & Permissions
  is_admin BOOLEAN DEFAULT FALSE,
  admin_level INTEGER DEFAULT 1 NOT NULL,
  user_level INTEGER DEFAULT 1 NOT NULL,
  
  -- Freemium & Rate Limiting System
  is_premium BOOLEAN DEFAULT FALSE,
  premium_expires_at TIMESTAMPTZ,
  today_submitted INTEGER DEFAULT 0,
  last_submission_date TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. QUESTIONS TABLE
CREATE TABLE questions (
  qid TEXT PRIMARY KEY, -- Custom string keys (e.g., 'MATH001')
  subject_tag TEXT NOT NULL,
  topic_tag TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  question_type TEXT CHECK (question_type IN ('MCQ', 'SPR')),
  
  -- Content (Parsed via ReactMarkdown & KaTeX)
  context TEXT,
  question TEXT NOT NULL,
  image_url TEXT,
  
  -- Multiple Choice Options (GFM compatible)
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  
  -- Answers & Explanations
  correct_answer TEXT NOT NULL,
  correct_answer_explanation TEXT,
  question_source TEXT,
  
  -- Bidirectional Sync Array
  assigned_modules UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cryptographic Hashing Optimization for Duplicate Detection (V2)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS options_hash TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_hash TEXT DEFAULT NULL;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS restructured_hash TEXT DEFAULT NULL;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_restructured_hash BOOLEAN DEFAULT FALSE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS all_options_hashes TEXT[] DEFAULT '{}';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty_rating INTEGER DEFAULT NULL;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS attendee_count INTEGER DEFAULT 0;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS unrated_attendee_count INTEGER DEFAULT 0;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS sum_of_expected_ratings INTEGER DEFAULT 0;



-- 4. MODULES TABLE
CREATE TABLE modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_name TEXT NOT NULL,
  time_limit_minutes INTEGER NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard', 'Mixed')),
  is_free BOOLEAN DEFAULT FALSE,
  required_level INTEGER DEFAULT 1 NOT NULL,
  
  -- Bidirectional Sync Array
  question_ids TEXT[] DEFAULT '{}',
  parent_directory TEXT DEFAULT '/root/modules',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SUBMISSIONS TABLE
CREATE TABLE submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  total_questions INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  score_estimate INTEGER,
  
  -- JSONB storage of exact student choices { "MATH001": "A", "MATH002": "12.5" }
  student_answers JSONB,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ENABLE ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- 7. ROW LEVEL SECURITY (RLS) POLICIES

-- Modules Access (Authenticated Only)
CREATE POLICY "Authenticated Read Modules" ON modules FOR SELECT USING (auth.role() = 'authenticated');

-- EXPLICIT LOCKDOWN ON QUESTIONS
-- We intentionally DO NOT create a policy for reading questions.
-- Because there is no policy, Supabase RLS will block 100% of client-side SELECT queries to the questions table.
-- Questions can ONLY be read via Server Actions using the Service Role Key.

-- Profiles Access
CREATE POLICY "Users view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON profiles FOR SELECT USING (public.is_admin());

-- Submissions Access
CREATE POLICY "Users view own submissions" ON submissions FOR SELECT USING (auth.uid() = student_id);
-- Admins view all submissions
CREATE POLICY "Admins view all submissions" ON submissions FOR SELECT USING (public.is_admin());

-- Admin Full Access
CREATE POLICY "Admins full access questions" ON questions FOR ALL USING (public.is_admin());
CREATE POLICY "Admins full access modules" ON modules FOR ALL USING (public.is_admin());


-- 9. TRIGGERS

-- A) Auto-Copy Auth Data to Profiles on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, whatsapp_number, institution, academic_year)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'whatsapp_number',
    new.raw_user_meta_data->>'institution',
    new.raw_user_meta_data->>'academic_year'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- B) FIFO Submission Cleanup with Dynamic Limits
CREATE OR REPLACE FUNCTION handle_fifo_submissions()
RETURNS trigger AS $$
DECLARE
   is_prem BOOLEAN;
   max_limit INTEGER;
BEGIN
   -- Safely check if the student is premium
   SELECT COALESCE(is_premium, FALSE) INTO is_prem FROM public.profiles WHERE id = NEW.student_id;
   
   -- Set the limit based on the user's tier
   IF is_prem THEN
     max_limit := 100;
   ELSE
     max_limit := 2;
   END IF;

   -- Delete older submissions
   DELETE FROM public.submissions
   WHERE id IN (
     SELECT id FROM public.submissions
     WHERE student_id = NEW.student_id
     ORDER BY submitted_at DESC
     OFFSET max_limit
   );
   
   RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_submission_insert
  AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE PROCEDURE handle_fifo_submissions();

-- 10. ZERO-TRUST PERMISSIONS (Explicit Grants)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO service_role;
GRANT SELECT ON public.questions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.modules TO service_role;
GRANT SELECT ON public.modules TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO service_role;
GRANT SELECT ON public.submissions TO authenticated;


-- 11. PRACTICE TESTS TABLE (Adaptive Test Definitions)
CREATE TABLE practice_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_name TEXT NOT NULL,
  test_type TEXT NOT NULL CHECK (test_type IN ('READING_WRITING', 'MATH', 'BOTH')),
  subject_order TEXT[] DEFAULT '{"READING_WRITING","MATH"}',
  is_free BOOLEAN DEFAULT FALSE,
  required_level INTEGER DEFAULT 1 NOT NULL,

  -- Reading & Writing adaptive config
  rw_base_module_id UUID REFERENCES modules(id),
  rw_easier_module_id UUID REFERENCES modules(id),
  rw_harder_module_id UUID REFERENCES modules(id),
  rw_threshold INTEGER,

  -- Math adaptive config
  math_base_module_id UUID REFERENCES modules(id),
  math_easier_module_id UUID REFERENCES modules(id),
  math_harder_module_id UUID REFERENCES modules(id),
  math_threshold INTEGER,
  parent_directory TEXT DEFAULT '/root/practice-tests',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. TEST SUBMISSIONS TABLE
CREATE TABLE test_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  test_id UUID REFERENCES practice_tests(id) ON DELETE CASCADE,

  rw_base_module_id UUID,
  rw_base_correct INTEGER,
  rw_base_total INTEGER,
  rw_path TEXT CHECK (rw_path IN ('easier', 'harder')),
  rw_adaptive_module_id UUID,
  rw_adaptive_correct INTEGER,
  rw_adaptive_total INTEGER,

  math_base_module_id UUID,
  math_base_correct INTEGER,
  math_base_total INTEGER,
  math_path TEXT CHECK (math_path IN ('easier', 'harder')),
  math_adaptive_module_id UUID,
  math_adaptive_correct INTEGER,
  math_adaptive_total INTEGER,

  total_correct INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  rw_score_estimate INTEGER,
  math_score_estimate INTEGER,

  student_answers JSONB,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Practice Tests & Test Submissions

-- 13. SECURITY DEFINER FUNCTION
-- Helper function to check if the current auth.uid() belongs to an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND admin_level >= 7
  );
$$;

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (admin_level >= 7 OR is_admin = true)
  );
$$;

ALTER TABLE practice_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated Read Practice Tests" ON practice_tests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins full access practice_tests" ON practice_tests FOR ALL USING (public.is_admin());

CREATE POLICY "Users view own test submissions" ON test_submissions FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Admins view all test submissions" ON test_submissions FOR SELECT USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_tests TO service_role;
GRANT SELECT ON public.practice_tests TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_submissions TO service_role;
GRANT SELECT ON public.test_submissions TO authenticated;
-- 14. FILES TABLE (Adjacency List for Directory Structure)
CREATE TABLE files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('folder', 'module', 'test', 'class')),
  parent_directory TEXT NOT NULL,
  reference_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Files Table Access
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated Read Files" ON files FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins full access files" ON files FOR ALL USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.files TO service_role;
GRANT SELECT ON public.files TO authenticated;

-- 15. SITE FEATURE TOGGLES TABLE (Maintenance Switches)
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

-- 16. SCHEDULED AUTO-TRIGGER UPGRADES TABLE
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
-- 4-TIER COLUMNAR ANALYTICS & TELEMETRY ENGINE (CONTENT DB - PROJECT B)
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

-- 2. Add 32 category/window tracking columns to practice_tests
ALTER TABLE public.practice_tests
ADD COLUMN IF NOT EXISTS free_started_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_started_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_started_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_started_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_submitted_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_submitted_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_submitted_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_submitted_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS practice_started_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_started_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_started_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_started_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS practice_submitted_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_submitted_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_submitted_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_submitted_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS flash_started_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_started_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_started_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_started_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS flash_submitted_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_submitted_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_submitted_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_submitted_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS master_started_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_started_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_started_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_started_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS master_submitted_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_submitted_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_submitted_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_submitted_all BIGINT DEFAULT 0;

-- 3. Add 32 category/window tracking columns to modules
ALTER TABLE public.modules
ADD COLUMN IF NOT EXISTS free_started_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_started_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_started_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_started_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_submitted_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_submitted_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_submitted_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS free_submitted_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS practice_started_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_started_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_started_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_started_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS practice_submitted_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_submitted_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_submitted_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS practice_submitted_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS flash_started_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_started_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_started_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_started_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS flash_submitted_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_submitted_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_submitted_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS flash_submitted_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS master_started_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_started_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_started_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_started_all BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS master_submitted_7d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_submitted_14d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_submitted_30d BIGINT DEFAULT 0, ADD COLUMN IF NOT EXISTS master_submitted_all BIGINT DEFAULT 0;

-- 4. Atomic RPC to increment target table (7d, 14d, 30d, all) and record today's delta
CREATE OR REPLACE FUNCTION increment_content_analytics(
  p_table TEXT,
  p_id UUID,
  p_metric TEXT,
  p_delta BIGINT
) RETURNS VOID AS $$
DECLARE
  v_col_7d TEXT := p_metric || '_7d';
  v_col_14d TEXT := p_metric || '_14d';
  v_col_30d TEXT := p_metric || '_30d';
  v_col_all TEXT := p_metric || '_all';
BEGIN
  IF p_table NOT IN ('practice_tests', 'modules') THEN
    RAISE EXCEPTION 'Invalid target table for content analytics: %', p_table;
  END IF;

  EXECUTE format('UPDATE public.%I SET %I = COALESCE(%I, 0) + $1, %I = COALESCE(%I, 0) + $1, %I = COALESCE(%I, 0) + $1, %I = COALESCE(%I, 0) + $1 WHERE id = $2',
                 p_table, v_col_7d, v_col_7d, v_col_14d, v_col_14d, v_col_30d, v_col_30d, v_col_all, v_col_all)
  USING p_delta, p_id;

  INSERT INTO public.analytics_daily_deltas (target_date, table_name, reference_id, metric_name, delta_value)
  VALUES (CURRENT_DATE, p_table, p_id::TEXT, p_metric, p_delta)
  ON CONFLICT (target_date, table_name, reference_id, metric_name)
  DO UPDATE SET delta_value = analytics_daily_deltas.delta_value + p_delta;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Prune Function for Freeze-Point Sliding Window Rollups
CREATE OR REPLACE FUNCTION prune_content_daily_deltas() RETURNS VOID AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM public.analytics_daily_deltas WHERE target_date = CURRENT_DATE - 8 LOOP
    EXECUTE format('UPDATE public.%I SET %I = GREATEST(COALESCE(%I, 0) - $1, 0) WHERE id = $2',
                   r.table_name, r.metric_name || '_7d', r.metric_name || '_7d')
    USING r.delta_value, r.reference_id::UUID;
  END LOOP;

  FOR r IN SELECT * FROM public.analytics_daily_deltas WHERE target_date = CURRENT_DATE - 15 LOOP
    EXECUTE format('UPDATE public.%I SET %I = GREATEST(COALESCE(%I, 0) - $1, 0) WHERE id = $2',
                   r.table_name, r.metric_name || '_14d', r.metric_name || '_14d')
    USING r.delta_value, r.reference_id::UUID;
  END LOOP;

  FOR r IN SELECT * FROM public.analytics_daily_deltas WHERE target_date = CURRENT_DATE - 31 LOOP
    EXECUTE format('UPDATE public.%I SET %I = GREATEST(COALESCE(%I, 0) - $1, 0) WHERE id = $2',
                   r.table_name, r.metric_name || '_30d', r.metric_name || '_30d')
    USING r.delta_value, r.reference_id::UUID;
  END LOOP;

  DELETE FROM public.analytics_daily_deltas WHERE target_date < CURRENT_DATE - 36;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 17. BUG REPORTS TABLE (3-Tier Cyberpunk Triage Command Center)
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
-- 23. PRACTICE ENGINE CONFIGURATION (User DB / General Settings)
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
