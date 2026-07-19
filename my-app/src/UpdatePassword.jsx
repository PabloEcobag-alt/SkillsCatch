import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    if (password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long.' });
      return;
    }

    setLoading(true);
    try {
      // SECURITY: This uses the secure session established by clicking the email link
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Password updated successfully! Redirecting...' });
      
      // Send them to the dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);

    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white p-8 md:p-12 rounded-2xl shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create New Password</h2>
        <p className="text-gray-500 mb-6">Your identity has been verified. Please enter your new password below.</p>
        
        {message.text && (
           <div className={`p-3 rounded mb-6 text-sm flex items-start gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
             {message.type === 'error' ? <AlertCircle size={16} className="mt-0.5" /> : <CheckCircle2 size={16} className="mt-0.5" />}
             <span className="font-medium">{message.text}</span>
           </div>
        )}

        <form onSubmit={handlePasswordUpdate} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-indigo-600 text-gray-900"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="password" required value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-indigo-600 text-gray-900"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-indigo-600 text-white rounded-lg py-3 font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Updating...' : 'Update Password'}
            {!loading && <ArrowRight size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
}