import { createClient } from '@supabase/supabase-js'

/**
 * AVAILABILITY STRATEGY:
 * - Supabase provides automated daily database backups (point-in-time recovery)
 * - Client-side caching reduces external API dependency (News: 15min, Jobs: 5min)
 * - Graceful error handling with retry mechanisms across all components
 * - Rate limiting protects against denial-of-service attacks
 * - Session auto-refresh ensures uninterrupted user access
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Configuration error. Please contact support.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);