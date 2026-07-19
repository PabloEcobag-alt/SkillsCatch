import React, { useState } from 'react';
import { Palette, User, Trash2, Key, Download, Bell, ChevronRight, AlertCircle, Check } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { logActivity } from './lib/logger';
import { useTheme } from './lib/ThemeContext';

export default function SettingsPage({ user, onOpenAvatarPicker, savedRoadmaps, userProfile }) {
  const { themeKey, setThemeKey, themes } = useTheme();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const handleExportData = () => {
    const exportData = {
      email: user?.email,
      profile: userProfile,
      roadmaps: savedRoadmaps,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skillscatch-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logActivity('Data Export', { format: 'json' });
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') return;
    setDeleting(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Not authenticated');

      await supabase.from('task_progress').delete().eq('user_id', currentUser.id);
      await supabase.from('roadmaps').delete().eq('user_id', currentUser.id);
      await supabase.from('profiles').delete().eq('id', currentUser.id);

      logActivity('Account Deletion', { email: currentUser.email });
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      console.error('Delete account error:', err);
      alert('Failed to delete account. Please contact support.');
    } finally {
      setDeleting(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user?.email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) throw error;
      logActivity('Password Reset Requested', { method: 'settings_page' });
      alert('Password reset link sent to your email!');
    } catch (err) {
      console.error(err);
      if (err?.status === 500 || err?.message?.includes('500')) {
        alert('Email service temporarily unavailable. Please try again in a few minutes.');
      } else if (err?.status === 429) {
        alert('Too many requests. Please wait a few minutes before trying again.');
      } else {
        alert('Failed to send reset link. Please try again later.');
      }
    }
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-8 max-w-3xl">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center theme-primary-bg text-white">
          <Palette size={24} />
        </div>
        <div>
          <h4 className="text-2xl font-bold theme-text">Settings</h4>
          <p className="theme-text-secondary text-sm">Customize your SkillsCatch experience</p>
        </div>
      </div>

      {/* Theme Selector */}
      <section className="p-6 rounded-2xl border theme-surface space-y-4">
        <h5 className="font-bold theme-text flex items-center gap-2"><Palette size={18} /> Color Theme</h5>
        <p className="text-sm theme-text-secondary">Choose a vibe that matches your style</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(themes).map(([key, t]) => (
            <button
              key={key}
              onClick={() => setThemeKey(key)}
              className={`relative p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                themeKey === key ? 'border-current shadow-lg' : 'border-slate-200 hover:border-slate-300'
              }`}
              style={{ borderColor: themeKey === key ? t.primaryHex : undefined }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: t.primaryHex }} />
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: t.accentHex }} />
                <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: t.sidebarBg, borderColor: t.surfaceBorder }} />
              </div>
              <p className="text-xs font-bold text-left" style={{ color: themeKey === key ? t.primaryHex : '#64748b' }}>{t.name}</p>
              {themeKey === key && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: t.primaryHex }}>
                  <Check size={12} className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Profile & Avatar */}
      <section className="p-6 rounded-2xl border theme-surface space-y-4">
        <h5 className="font-bold theme-text flex items-center gap-2"><User size={18} /> Profile & Avatar</h5>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium theme-text">Profile Picture</p>
            <p className="text-xs theme-text-secondary">Upload a photo or choose an avatar</p>
          </div>
          <button onClick={onOpenAvatarPicker} className="px-4 py-2 text-sm font-bold rounded-xl transition-colors theme-primary-bg text-white hover:opacity-90">
            Change Avatar
          </button>
        </div>
      </section>

      {/* Change Password */}
      <section className="p-6 rounded-2xl border theme-surface space-y-4">
        <h5 className="font-bold theme-text flex items-center gap-2"><Key size={18} /> Security</h5>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium theme-text">Change Password</p>
            <p className="text-xs theme-text-secondary">Receive a password reset link via email</p>
          </div>
          <button onClick={handleChangePassword} className="flex items-center gap-1 px-4 py-2 text-sm font-bold border rounded-xl hover:bg-black/5 transition-colors theme-text theme-border">
            Send Link <ChevronRight size={14} />
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section className="p-6 rounded-2xl border theme-surface space-y-4">
        <h5 className="font-bold theme-text flex items-center gap-2"><Bell size={18} /> Notifications</h5>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium theme-text">Email Notifications</p>
            <p className="text-xs theme-text-secondary">Get updates about new features and tips</p>
          </div>
          <button
            onClick={() => setNotifications(!notifications)}
            className={`w-12 h-6 rounded-full transition-all relative ${notifications ? 'bg-green-500' : 'bg-slate-300'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${notifications ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
      </section>

      {/* Export Data */}
      <section className="p-6 rounded-2xl border theme-surface space-y-4">
        <h5 className="font-bold theme-text flex items-center gap-2"><Download size={18} /> Data Export</h5>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium theme-text">Export My Data</p>
            <p className="text-xs theme-text-secondary">Download your profile and roadmaps as JSON</p>
          </div>
          <button onClick={handleExportData} className="flex items-center gap-1 px-4 py-2 text-sm font-bold border rounded-xl hover:bg-black/5 transition-colors theme-text theme-border">
            <Download size={14} /> Export
          </button>
        </div>
      </section>

      {/* Delete Account — Danger Zone */}
      <section className="p-6 rounded-2xl border border-red-200 bg-red-50/50 space-y-4">
        <h5 className="font-bold text-red-700 flex items-center gap-2"><Trash2 size={18} /> Danger Zone</h5>
        {!showDeleteConfirm ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-800">Delete Account</p>
              <p className="text-xs text-red-600/70">Permanently remove your account and all data</p>
            </div>
            <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors">
              Delete Account
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-red-100 rounded-xl">
              <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">This action is <strong>irreversible</strong>. All your roadmaps, progress, and profile data will be permanently deleted. Type <strong>DELETE</strong> to confirm.</p>
            </div>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              className="w-full px-4 py-2.5 border border-red-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'DELETE' || deleting}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
