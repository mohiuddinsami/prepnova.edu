-- 1. Create the Practice Config Table
CREATE TABLE IF NOT EXISTS public.practice_config (
  id INT PRIMARY KEY DEFAULT 1,
  allowed_sources JSONB DEFAULT '[]'::jsonb,
  level_1_limit INT DEFAULT 10,
  level_2_limit INT DEFAULT 100,
  level_3_limit INT DEFAULT -1,
  level_4_limit INT DEFAULT -1,
  level_5_limit INT DEFAULT -1,
  level_6_limit INT DEFAULT -1
);

-- 2. Insert the initial singleton row
INSERT INTO public.practice_config (id, allowed_sources) 
VALUES (1, '[]'::jsonb) 
ON CONFLICT (id) DO NOTHING;

-- 3. Security & Permissions
ALTER TABLE public.practice_config ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_config TO service_role;
