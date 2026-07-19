import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { useTheme } from './lib/ThemeContext';
import BulkUserImport from './BulkUserImport';
import {
  Shield, Users, Activity, ArrowLeft, Search, Trash2,
  UserX, UserCheck, RefreshCw, ChevronDown, AlertCircle, Bot
} from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [logFilter, setLogFilter] = useState('all');
  const [stats, setStats] = useState({ totalUsers: 0, totalLogs: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all profiles (admin RLS allows this)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, role, avatar_url, target_role, theme, created_at')
        .order('created_at', { ascending: false });

      // Fetch audit logs
      const { data: logsData } = await supabase
        .from('audit_logs')
        .select('id, user_id, action, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      const profilesList = profilesData || [];
      const logsList = logsData || [];

      setUsers(profilesList);
      setLogs(logsList);
      setStats({
        totalUsers: profilesList.length,
        totalLogs: logsList.length,
      });
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!confirm(`Are you sure you want to delete ${userEmail}? This action cannot be undone.`)) return;

    try {
      // Call Edge Function to delete auth user (requires service role key)
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      // Log the admin action
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: `Admin deleted user: ${userEmail}`,
      });

      setUsers(prev => prev.filter(u => u.id !== userId));
      alert(`User ${userEmail} has been deleted.`);
    } catch (err) {
      console.error('Delete user error:', err);
      alert('Failed to delete user. Please try again.');
    }
  };

  const handleToggleRole = async (userId, userEmail, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change ${userEmail} role to ${newRole}?`)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: `Admin changed role of ${userEmail} to ${newRole}`,
      });

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error('Role change error:', err);
      alert('Failed to change role. Please try again.');
    }
  };

  const filteredUsers = users.filter(u =>
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.target_role || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLogs = logs.filter(l =>
    logFilter === 'all' ? true : l.action?.toLowerCase().includes(logFilter.toLowerCase())
  );

  const formatDate = (d) => {
    try {
      return new Date(d).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return '-'; }
  };

  // Find email for a user_id in logs
  const getUserEmail = (userId) => {
    const u = users.find(p => p.id === userId);
    return u?.email?.split('@')[0] || userId?.slice(0, 8) || 'Unknown';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-page-bg)' }}>
      {/* Header */}
      <header className="glass border-b px-6 py-4 flex items-center justify-between theme-border">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-black/5 theme-text-secondary">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center theme-primary-bg text-white">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Admin Dashboard</h1>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>User Management & Security Audit</p>
            </div>
          </div>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold theme-primary-bg text-white hover:opacity-90 transition-opacity">
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl border theme-surface">
            <div className="flex items-center gap-3 mb-2">
              <Users size={18} style={{ color: 'var(--color-primary-hex)' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Total Users</span>
            </div>
            <p className="text-3xl font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>{stats.totalUsers}</p>
          </div>
          <div className="p-5 rounded-2xl border theme-surface">
            <div className="flex items-center gap-3 mb-2">
              <Activity size={18} style={{ color: 'var(--color-primary-hex)' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Audit Events</span>
            </div>
            <p className="text-3xl font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>{stats.totalLogs}</p>
          </div>
          <div className="p-5 rounded-2xl border theme-surface">
            <div className="flex items-center gap-3 mb-2">
              <Shield size={18} style={{ color: 'var(--color-primary-hex)' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Admin Accounts</span>
            </div>
            <p className="text-3xl font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>{users.filter(u => u.role === 'admin').length}</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 p-1 rounded-xl bg-black/5">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'users' ? 'theme-primary-bg text-white shadow-md' : 'theme-text-secondary hover:bg-black/5'
            }`}
          >
            <Users size={16} /> Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'logs' ? 'theme-primary-bg text-white shadow-md' : 'theme-text-secondary hover:bg-black/5'
            }`}
          >
            <Activity size={16} /> Audit Logs ({logs.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--color-primary-hex)' }}></div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading admin data...</p>
          </div>
        ) : activeTab === 'users' ? (
          /* =================== USERS TAB =================== */
          <div className="space-y-4">
            {/* Bulk User Import */}
            <BulkUserImport onImportComplete={fetchData} />
            
            {/* Search */}
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
              <input
                type="text"
                placeholder="Search by email or target role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl border text-sm outline-none theme-surface theme-border"
                style={{ color: 'var(--color-text-primary)' }}
              />
            </div>

            {/* Users List */}
            <div className="rounded-2xl border overflow-hidden theme-surface">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-surface-border)' }}>
                      <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>User</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Role</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--color-text-secondary)' }}>Target Role</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider hidden lg:table-cell" style={{ color: 'var(--color-text-secondary)' }}>Joined</th>
                      <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-black/5 transition-colors" style={{ borderBottom: '1px solid var(--color-surface-border)' }}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white theme-primary-bg">
                                {(u.email || '?')[0].toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium truncate max-w-[200px]" style={{ color: 'var(--color-text-primary)' }}>{u.email}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                            u.role === 'admin' 
                              ? 'bg-red-500/10 text-red-500' 
                              : 'bg-green-500/10 text-green-500'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell" style={{ color: 'var(--color-text-secondary)' }}>
                          {u.target_role || <span className="opacity-40">Not set</span>}
                        </td>
                        <td className="px-5 py-4 text-xs hidden lg:table-cell" style={{ color: 'var(--color-text-secondary)' }}>
                          {formatDate(u.created_at)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleRole(u.id, u.email, u.role)}
                              className="p-2 rounded-lg hover:bg-black/5 transition-colors"
                              title={u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                            >
                              {u.role === 'admin' 
                                ? <UserX size={16} className="text-orange-500" /> 
                                : <UserCheck size={16} className="text-green-500" />
                              }
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.email)}
                              className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-red-500"
                              title="Delete User"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredUsers.length === 0 && (
                <div className="text-center py-12">
                  <Users size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--color-text-secondary)' }} />
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No users found.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* =================== AUDIT LOGS TAB =================== */
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
              {['all', 'login', 'logout', 'mfa', 'roadmap', 'export', 'delete', 'admin'].map(f => (
                <button
                  key={f}
                  onClick={() => setLogFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                    logFilter === f ? 'theme-primary-bg text-white' : 'theme-text-secondary hover:bg-black/5'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Logs List */}
            <div className="rounded-2xl border overflow-hidden theme-surface">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-surface-border)' }}>
                      <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Timestamp</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>User</th>
                      <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-black/5 transition-colors" style={{ borderBottom: '1px solid var(--color-surface-border)' }}>
                        <td className="px-5 py-3 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ color: 'var(--color-primary-hex)', backgroundColor: 'rgba(var(--color-primary), 0.1)' }}>
                            {getUserEmail(log.user_id)}
                          </span>
                        </td>
                        <td className="px-5 py-3" style={{ color: 'var(--color-text-primary)' }}>
                          {log.action}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredLogs.length === 0 && (
                <div className="text-center py-12">
                  <Activity size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--color-text-secondary)' }} />
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No audit logs found.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
