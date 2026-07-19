import { supabase } from './supabaseClient';

export const logActivity = async (action, metadata = {}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: action,
      metadata: metadata
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
};

// Convenience: log with explicit user_id (for login events where session may not be fully set)
export const logActivityForUser = async (userId, action, metadata = {}) => {
  try {
    if (!userId) return;
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: action,
      metadata: metadata
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
};