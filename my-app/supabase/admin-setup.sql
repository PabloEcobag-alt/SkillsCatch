-- 1. Add role column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' 
CHECK (role IN ('user', 'admin'));

-- 2. Create audit_logs table if not exists
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Helper function to check admin (SECURITY DEFINER bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 5. Profiles RLS policies
-- Users can read their own profile
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admins can read ALL profiles (uses function to avoid recursion)
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

-- 5. Audit logs RLS policies
-- Any authenticated user can insert their own logs
DROP POLICY IF EXISTS "Users insert own logs" ON public.audit_logs;
CREATE POLICY "Users insert own logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own logs
DROP POLICY IF EXISTS "Users read own logs" ON public.audit_logs;
CREATE POLICY "Users read own logs" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can read ALL audit logs
DROP POLICY IF EXISTS "Admins read all logs" ON public.audit_logs;
CREATE POLICY "Admins read all logs" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

-- 6. Create index for faster audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 7. SET YOUR ACCOUNT AS ADMIN (replace with your actual email)
UPDATE public.profiles SET role = 'admin' WHERE id = (
SELECT id FROM auth.users WHERE email = 'carillomarkpaulo@gmail.com'
);
