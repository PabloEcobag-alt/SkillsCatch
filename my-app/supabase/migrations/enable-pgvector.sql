-- Enable pgvector extension for RAG architecture
-- Run this in Supabase SQL Editor

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table for skill embeddings
CREATE TABLE IF NOT EXISTS public.skill_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  skill TEXT NOT NULL UNIQUE,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_skill_embeddings_embedding 
ON public.skill_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Enable RLS
ALTER TABLE public.skill_embeddings ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can insert/read
DROP POLICY IF EXISTS "Admins can manage embeddings" ON public.skill_embeddings;
CREATE POLICY "Admins can manage embeddings" ON public.skill_embeddings
  FOR ALL USING (public.is_admin());

-- Grant usage on vector type
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.skill_embeddings TO anon, authenticated;

-- Demo query for similar skills (replace with actual embedding vector)
-- SELECT skill, category, 
--        1 - (embedding <=> '[0.1,0.2,0.3,...]'::vector) as similarity
-- FROM public.skill_embeddings
-- ORDER BY embedding <=> '[0.1,0.2,0.3,...]'::vector
-- LIMIT 5;
