import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { ShieldCheck, Save, Wifi, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

interface LdapConfig {
  id?: string;
  enabled: boolean;
  url: string;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
  userFilter: string;
  usernameAttribute: string;
  emailAttribute: string;
  tlsEnabled: boolean;
  syncIntervalMinutes: number;
}

const defaultConfig: LdapConfig = {
  enabled: false,
  url: '',
  bindDn: '',
  bindPassword: '',
  baseDn: '',
  userFilter: '(&(objectCategory=person)(sAMAccountName={username}))',
  usernameAttribute: 'sAMAccountName',
  emailAttribute: 'mail',
  tlsEnabled: false,
  syncIntervalMinutes: 60,
};

export default function LDAPSettings() {
  const [config, setConfig] = useState<LdapConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    api.get('/settings/ldap')
      .then(res => { if (res.data?.url !== undefined) setConfig(res.data); })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      await api.post('/settings/ldap', config);
      setSaveStatus('ok');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/settings/ldap/test', config);
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.error || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const field = (label: string, key: keyof LdapConfig, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={String(config[key] ?? '')}
        onChange={e => setConfig({ ...config, [key]: e.target.value })}
        className="block w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
      />
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white font-outfit">LDAP / AD Configuration</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Configure enterprise LDAP or Active Directory integration.</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleTest}
            disabled={testing || !config.url}
            className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <Wifi className={`w-4 h-4 mr-2 text-blue-500 ${testing ? 'animate-pulse' : ''}`} />
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            {saving
              ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              : saveStatus === 'ok'
                ? <CheckCircle className="w-4 h-4 mr-2 text-green-300" />
                : <Save className="w-4 h-4 mr-2" />}
            {saving ? 'Saving...' : saveStatus === 'ok' ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      {testResult && (
        <div className={`flex items-center p-4 rounded-xl border text-sm font-medium ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
          {testResult.success
            ? <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            : <XCircle className="w-5 h-5 mr-2 flex-shrink-0" />}
          {testResult.message}
        </div>
      )}

      <div className="enterprise-card p-6 space-y-6">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center">
            <ShieldCheck className="w-5 h-5 text-blue-600 mr-3" />
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Enable LDAP Authentication</p>
              <p className="text-xs text-gray-500 mt-0.5">Allow users to sign in with corporate directory credentials.</p>
            </div>
          </div>
          <button
            onClick={() => setConfig({ ...config, enabled: !config.enabled })}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${config.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${config.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Connection */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center">
            <span className="w-1 h-4 bg-blue-600 rounded-full mr-2" /> Connection
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field('Server URL', 'url', 'text', 'ad.example.com:389')}
            {field('Base DN', 'baseDn', 'text', 'DC=example,DC=com')}
            {field('Bind DN', 'bindDn', 'text', 'CN=admin,DC=example,DC=com')}
            {field('Bind Password', 'bindPassword', 'password', '••••••••')}
          </div>
          <div className="flex items-center mt-4">
            <input
              id="tls"
              type="checkbox"
              checked={config.tlsEnabled}
              onChange={e => setConfig({ ...config, tlsEnabled: e.target.checked })}
              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="tls" className="ml-2 text-sm text-gray-700 dark:text-gray-300">Enable TLS/StartTLS</label>
          </div>
        </div>

        {/* User Mapping */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center">
            <span className="w-1 h-4 bg-indigo-600 rounded-full mr-2" /> User Mapping
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field('User Filter', 'userFilter', 'text', '(&(objectClass=person)(sAMAccountName={username}))')}
            {field('Username Attribute', 'usernameAttribute', 'text', 'sAMAccountName')}
            {field('Email Attribute', 'emailAttribute', 'text', 'mail')}
            {field('Sync Interval (min)', 'syncIntervalMinutes', 'number', '60')}
          </div>
        </div>
      </div>
    </div>
  );
}

