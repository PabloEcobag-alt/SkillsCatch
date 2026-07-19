import React from 'react';
import { 
  User, ShieldCheck, Target, LogOut, 
  Settings, Award, ChevronRight, CheckCircle 
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function ProfileSidebar({ profile, isOpen, onClose, avatarUrl }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // Mock calculation for profile completion
  const completion = profile?.target_role ? 100 : 60;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`fixed right-0 top-0 h-full w-80 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out theme-sidebar ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
          
          {/* Header & Avatar */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold theme-text">My Profile</h2>
            <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full theme-text-secondary">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-full flex items-center justify-center border-4 mb-4 relative overflow-hidden" style={{ borderColor: 'var(--color-surface-border)', backgroundColor: 'rgba(var(--color-primary), 0.1)' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={48} className="theme-primary" />
              )}
              <div className="absolute bottom-0 right-0 bg-green-500 border-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ borderColor: 'var(--color-sidebar-bg)' }}>
                <ShieldCheck size={14} className="text-white" />
              </div>
            </div>
            <p className="font-bold text-lg theme-text">{profile?.email?.split('@')[0] || 'User'}</p>
            <div className="flex items-center gap-1 text-xs text-green-600 font-bold bg-green-500/10 px-2 py-1 rounded-full mt-2">
              <CheckCircle size={12} /> VERIFIED ACCOUNT
            </div>
          </div>

          {/* Profile Completion */}
          <div className="mb-8">
            <div className="flex justify-between text-xs font-bold theme-text-secondary mb-2">
              <span>PROFILE COMPLETION</span>
              <span>{completion}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface-border)' }}>
              <div 
                className="h-full transition-all duration-1000 theme-primary-bg" 
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>

          {/* User Data Sections */}
          <div className="space-y-4 flex-1">
            <div className="p-4 rounded-xl border theme-surface">
              <div className="flex items-center gap-3 theme-text-secondary mb-2">
                <Target size={18} />
                <span className="text-sm font-bold">Target IT Role</span>
              </div>
              <p className="font-semibold theme-primary">{profile?.target_role || 'Not set yet'}</p>
            </div>

            <div className="p-4 rounded-xl border theme-surface">
              <div className="flex items-center gap-3 theme-text-secondary mb-2">
                <Award size={18} />
                <span className="text-sm font-bold">Skills Earned</span>
              </div>
              <p className="theme-text-secondary text-sm italic">Analyze your first resume to unlock skills tracking.</p>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-6 border-t space-y-2 theme-border">
            <button 
              onClick={() => navigate('/settings')}
              className="w-full flex items-center gap-3 p-3 theme-text-secondary hover:bg-black/5 rounded-xl transition-colors font-medium"
            >
              <Settings size={20} /> Settings
            </button>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors font-bold"
            >
              <LogOut size={20} /> Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
}