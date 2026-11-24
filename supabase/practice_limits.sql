ALTER TABLE public.practice_config
ADD COLUMN IF NOT EXISTS level_1_limit integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS level_2_limit integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS level_3_limit integer DEFAULT -1,
ADD COLUMN IF NOT EXISTS level_4_limit integer DEFAULT -1,
ADD COLUMN IF NOT EXISTS level_5_limit integer DEFAULT -1,
ADD COLUMN IF NOT EXISTS level_6_limit integer DEFAULT -1;
