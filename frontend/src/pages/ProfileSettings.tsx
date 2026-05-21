import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { User, Shield, CheckCircle, AlertCircle, Key } from 'lucide-react';

interface Profile {
  username: string;
  email: string;
  role: string;
  authType: string;
}

export default function ProfileSettings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    api.get('/auth/me')
      .then(res => setProfile(res.data))
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    if (!newPassword) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/users/me/password', { newPassword });
      setMessage({ type: 'success', text: 'Password updated successfully' });
      setNewPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update password' });
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Loading profile...</div>;
  }

  return (
    <div className="max-w-2xl space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white font-outfit">My Profile</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your account settings and credentials.</p>
      </div>

      <div className="enterprise-card p-6 space-y-6">
        <div className="flex items-center space-x-4 border-b border-gray-100 dark:border-gray-800 pb-6">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {profile.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold dark:text-white">{profile.username}</h2>
            <div className="flex items-center mt-1 space-x-3 text-sm text-gray-500">
              <span className="flex items-center"><Shield className="w-4 h-4 mr-1 text-blue-500" /> {profile.role}</span>
              <span className="uppercase text-xs font-bold px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-md">
                {profile.authType}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
            <input 
              type="text" 
              disabled 
              value={profile.email || 'No email associated'} 
              className="block w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-sm cursor-not-allowed" 
            />
          </div>

          {profile.authType.toLowerCase() === 'ldap' ? (
             <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex items-start">
               <AlertCircle className="w-5 h-5 text-blue-500 mr-3 mt-0.5" />
               <div>
                 <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100">LDAP Managed Account</h4>
                 <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">Your password is managed by your organization's Active Directory/LDAP server. You cannot change it here.</p>
               </div>
             </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
              <input 
                type="password" 
                placeholder="Enter new password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="block w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
              />
              
              {message && (
                <div className={`mt-3 flex items-center text-sm font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {message.type === 'success' ? <CheckCircle className="w-4 h-4 mr-1" /> : <AlertCircle className="w-4 h-4 mr-1" />}
                  {message.text}
                </div>
              )}

              <button 
                onClick={handleSave}
                disabled={saving || !newPassword}
                className="flex items-center px-4 py-2 mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <Key className="w-4 h-4 mr-2" />
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
