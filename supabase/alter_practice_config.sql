-- Add the new limit columns to the existing practice_config table
ALTER TABLE public.practice_config ADD COLUMN IF NOT EXISTS level_1_limit INT DEFAULT 10;
ALTER TABLE public.practice_config ADD COLUMN IF NOT EXISTS level_2_limit INT DEFAULT 100;
ALTER TABLE public.practice_config ADD COLUMN IF NOT EXISTS level_3_limit INT DEFAULT -1;
ALTER TABLE public.practice_config ADD COLUMN IF NOT EXISTS level_4_limit INT DEFAULT -1;
ALTER TABLE public.practice_config ADD COLUMN IF NOT EXISTS level_5_limit INT DEFAULT -1;
ALTER TABLE public.practice_config ADD COLUMN IF NOT EXISTS level_6_limit INT DEFAULT -1;
