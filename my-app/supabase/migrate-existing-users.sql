-- Create profiles for existing users who don't have one
INSERT INTO public.profiles (id, email, full_name, role, avatar_url, target_role, theme, created_at)
SELECT 
  id,
  email,
  raw_user_meta_data->>'full_name',
  'user',
  raw_user_meta_data->>'avatar_url',
  NULL,
  'light',
  created_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);
