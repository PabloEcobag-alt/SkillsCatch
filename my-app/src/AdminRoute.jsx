import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';

export default function AdminRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      setIsAdmin(profile?.role === 'admin');
      setLoading(false);
    };

    checkAdmin();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-page-bg)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" 
          style={{ borderColor: 'var(--color-primary-hex)' }}></div>
          <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
