import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';

const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Initial session check
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthenticated(!!session);
      setLoading(false);
    };

    checkUser();

    // Real-time session listener — handles token expiry, sign out from another tab, etc.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        if (event === 'SIGNED_OUT') {
          setAuthenticated(false);
          navigate('/', { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-page-bg)' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-primary-hex)' }}></div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;