-- Fix foreign key constraints to use ON DELETE CASCADE
-- This ensures orphaned records are cleaned up when auth users are deleted
-- Run this in Supabase SQL Editor

-- Fix profiles FK
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_id_fkey,
  ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix roadmaps FK
ALTER TABLE public.roadmaps 
  DROP CONSTRAINT IF EXISTS roadmaps_user_id_fkey,
  ADD CONSTRAINT roadmaps_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix task_progress FK
ALTER TABLE public.task_progress 
  DROP CONSTRAINT IF EXISTS task_progress_user_id_fkey,
  ADD CONSTRAINT task_progress_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix audit_logs FK
ALTER TABLE public.audit_logs 
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey,
  ADD CONSTRAINT audit_logs_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix NOT NULL constraints for data integrity
ALTER TABLE public.roadmaps 
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.audit_logs 
  ALTER COLUMN user_id SET NOT NULL;

-- Fix pgvector type if needed (after pgvector extension is enabled)
-- ALTER TABLE public.skill_embeddings 
--   ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector(1536);
