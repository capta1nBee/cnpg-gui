import React, { useState, useEffect } from 'react';
import { Mail, Save, RefreshCw, Shield, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import { useUI } from '../context/UIContext';

export default function EmailSettings() {
  const [settings, setSettings] = useState({
    enabled: false,
    host: '',
    port: 587,
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'Poyraz-CNPG',
    encryptionType: 'STARTTLS',
    authEnabled: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useUI();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings/email');
      if (res.data) {
        setSettings(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch email settings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/settings/email', settings);
      toast('Email settings saved successfully', 'success');
    } catch (err) {
      toast('Failed to save email settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await api.post('/settings/email/test', settings);
      toast(res.data || 'Connection test successful', 'success');
    } catch (err: any) {
      toast(err.response?.data || 'Connection test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white font-outfit">Email Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Configure SMTP server settings for invitations and system notifications.</p>
        </div>
        <div className="flex items-center space-x-3">
            <button 
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 disabled:opacity-50"
            >
                {testing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                Test Connection
            </button>
            <button 
                onClick={handleSave}
                disabled={saving}
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
                {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="enterprise-card p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <Mail className="w-5 h-5 mr-2 text-blue-500" /> Server Configuration
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">SMTP Host</label>
                    <input 
                        type="text" 
                        value={settings.host}
                        onChange={e => setSettings({...settings, host: e.target.value})}
                        className="enterprise-input"
                        placeholder="smtp.example.com"
                    />
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Port</label>
                    <input 
                        type="number" 
                        value={settings.port}
                        onChange={e => setSettings({...settings, port: parseInt(e.target.value)})}
                        className="enterprise-input"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Encryption</label>
                    <select 
                        value={settings.encryptionType}
                        onChange={e => setSettings({...settings, encryptionType: e.target.value})}
                        className="enterprise-input"
                    >
                        <option value="NONE">None</option>
                        <option value="STARTTLS">STARTTLS</option>
                        <option value="SSL">SSL/TLS</option>
                    </select>
                </div>

                <div className="md:col-span-2 border-t border-gray-100 dark:border-gray-800 pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">Authentication</h4>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={settings.authEnabled} 
                                onChange={e => setSettings({...settings, authEnabled: e.target.checked})}
                                className="sr-only peer" 
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    {settings.authEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Username</label>
                                <input 
                                    type="text" 
                                    value={settings.username}
                                    onChange={e => setSettings({...settings, username: e.target.value})}
                                    className="enterprise-input"
                                />
                            </div>
                            <div className="relative">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    value={settings.password}
                                    onChange={e => setSettings({...settings, password: e.target.value})}
                                    className="enterprise-input pr-10"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
          </div>

          <div className="enterprise-card p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <Lock className="w-5 h-5 mr-2 text-blue-500" /> Sender Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">From Name</label>
                    <input 
                        type="text" 
                        value={settings.fromName}
                        onChange={e => setSettings({...settings, fromName: e.target.value})}
                        className="enterprise-input"
                        placeholder="Poyraz-CNPG System"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">From Email</label>
                    <input 
                        type="email" 
                        value={settings.fromEmail}
                        onChange={e => setSettings({...settings, fromEmail: e.target.value})}
                        className="enterprise-input"
                        placeholder="noreply@example.com"
                    />
                </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
            <div className="enterprise-card p-6 bg-blue-600 text-white">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Service Status</h3>
                    <div className={`p-1.5 rounded-full ${settings.enabled ? 'bg-white/20' : 'bg-red-500/30'}`}>
                        {settings.enabled ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    </div>
                </div>
                <p className="text-blue-100 text-sm mb-6">
                    When enabled, the system can send invitations and alert notifications via email.
                </p>
                <button 
                    onClick={() => setSettings({...settings, enabled: !settings.enabled})}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${settings.enabled ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-white/20 text-white hover:bg-white/30'}`}
                >
                    {settings.enabled ? 'Disable Service' : 'Enable Service'}
                </button>
            </div>

            <div className="enterprise-card p-6 border-l-4 border-l-amber-500">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Security Tip</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    We recommend using an App Password or an API token if your SMTP provider supports it (like Gmail or SendGrid). Avoid using your primary account password.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}
