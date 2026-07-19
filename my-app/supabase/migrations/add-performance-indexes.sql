-- Add performance indexes for SkillsCatch database
-- Run this in Supabase SQL Editor

-- Index for audit_logs user_id queries (most frequent)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_created 
ON public.audit_logs(user_id, created_at DESC);

-- Index for roadmaps user_id + target_role (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_roadmaps_user_target 
ON public.roadmaps(user_id, target_role);

-- Index for task_progress composite lookup (progress tracking)
CREATE INDEX IF NOT EXISTS idx_task_progress_composite 
ON public.task_progress(user_id, target_role, week_number, task_index);

-- Index for profiles role filtering (admin queries)
CREATE INDEX IF NOT EXISTS idx_profiles_role 
ON public.profiles(role) WHERE role = 'admin';

-- Analyze tables for query planner optimization
ANALYZE public.audit_logs;
ANALYZE public.roadmaps;
ANALYZE public.task_progress;
ANALYZE public.profiles;
