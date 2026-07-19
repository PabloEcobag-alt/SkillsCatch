import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          navigate('/?error=auth_failed');
          return;
        }

        if (data.session) {
          navigate('/dashboard');
        } else {
          navigate('/');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        navigate('/');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-lg font-medium">Completing sign in...</p>
      </div>
    </div>
  );
}
