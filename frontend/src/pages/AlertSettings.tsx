import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Mail, MessageSquare, Globe, Plus, Trash2, AlertTriangle, CheckCircle2, Filter, RefreshCw, type LucideIcon } from 'lucide-react';
import api from '../api/axios';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';

interface Rule {
  id: string;
  metricType: string;
  comparison: string;
  threshold: number;
  clusterName?: string;
  durationMinutes: number;
  status?: string;
}

interface Channel {
  id: string;
  channelType: 'SLACK' | 'EMAIL' | 'WEBHOOK';
  targetConfig: string;
  enabled: boolean;
}

interface ActiveAlertItem {
  id: string;
  ruleId: string;
  tenantId?: string;
  clusterName: string;
  metricType: string;
  comparison: string;
  threshold: number;
  currentValue: number;
  status: 'OPEN' | 'CLOSED';
  severity: string;
  openedAt: string;
  closedAt?: string;
  lastEvaluatedAt: string;
}

export default function AlertSettings() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlertItem[]>([]);
  const [alertStatusFilter, setAlertStatusFilter] = useState<string>('OPEN');
  const [alertClusterFilter, setAlertClusterFilter] = useState<string>('');
  const [alertsLoading, setAlertsLoading] = useState(false);
  const { toast } = useUI();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('alarms');
  const { activeEnvironmentId } = useTenant();
  
  const isViewer = user?.role?.toUpperCase() === 'VIEWER';

  // Rule Modal State
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<Partial<Rule>>({
    metricType: 'CPU_USAGE',
    comparison: '>',
    threshold: 80,
    durationMinutes: 5,
    clusterName: 'all',
    status: 'active'
  });

  const fetchActiveAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const params: any = {};
      if (alertStatusFilter) params.status = alertStatusFilter;
      if (alertClusterFilter) params.clusterName = alertClusterFilter;
      const res = await api.get('/alerts/active', { params });
      setActiveAlerts(res.data || []);
    } catch (err) {
      console.error('Failed to fetch active alerts', err);
    } finally {
      setAlertsLoading(false);
    }
  }, [alertStatusFilter, alertClusterFilter]);

  const fetchData = useCallback(async () => {
    try {
      const [rulesRes, channelsRes, clustersRes] = await Promise.all([
        api.get('/alerts/rules'),
        api.get('/alerts/channels'),
        api.get('/clusters')
      ]);
      setRules(rulesRes.data || []);
      setChannels(channelsRes.data || []);
      setClusters(clustersRes.data || []);
    } catch (err) {
      console.error('Failed to fetch alert data', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchActiveAlerts();
  }, [fetchData, fetchActiveAlerts, activeEnvironmentId]);

  const handleSaveRule = async () => {
    try {
      if (currentRule.id) {
        await api.put(`/alerts/rules/${currentRule.id}`, currentRule);
        toast('Alert rule updated!', 'success');
      } else {
        await api.post('/alerts/rules', currentRule);
        toast('Alert rule created!', 'success');
      }
      fetchData();
      setIsRuleModalOpen(false);
    } catch (err) {
      toast('Failed to save rule.', 'error');
    }
  };

  const handleEditRule = (rule: Rule) => {
    setCurrentRule(rule);
    setIsRuleModalOpen(true);
  };

  const handleToggleRuleStatus = async (rule: Rule) => {
    try {
      const newStatus = rule.status === 'active' ? 'inactive' : 'active';
      await api.put(`/alerts/rules/${rule.id}`, { ...rule, status: newStatus });
      fetchData();
      toast(`Rule ${newStatus}!`, 'success');
    } catch (err) {
      toast('Failed to toggle rule status.', 'error');
    }
  };

  const handleSaveChannel = async (channel: Partial<Channel>) => {
    try {
      if (channel.id) {
        await api.put(`/alerts/channels/${channel.id}`, channel);
        toast('Channel updated!', 'success');
      } else {
        await api.post('/alerts/channels', channel);
        toast('Channel created!', 'success');
      }
      fetchData();
    } catch (err) {
      toast('Failed to save channel.', 'error');
    }
  };

  const handleDeleteChannel = async (id: string) => {
    try {
      await api.delete(`/alerts/channels/${id}`);
      fetchData();
      toast('Channel removed', 'success');
    } catch (err) {
      toast('Failed to remove channel.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold dark:text-white flex items-center">
          <Bell className="w-8 h-8 mr-2 text-red-500" /> Observability & Alerting
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button onClick={() => setActiveTab('alarms')} className={`px-6 py-3 text-sm font-medium flex items-center space-x-2 ${activeTab === 'alarms' ? 'border-b-2 border-red-500 text-red-600' : 'text-gray-500'}`}>
            <AlertTriangle className="w-4 h-4" /><span>Active Alarms</span>
            {activeAlerts.filter(a => a.status === 'OPEN').length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-black bg-red-500 text-white rounded-full">
                {activeAlerts.filter(a => a.status === 'OPEN').length}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab('rules')} className={`px-6 py-3 text-sm font-medium ${activeTab === 'rules' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>
            Alerting Rules
          </button>
          {!isViewer && (
            <button onClick={() => setActiveTab('channels')} className={`px-6 py-3 text-sm font-medium ${activeTab === 'channels' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>
              Notification Channels
            </button>
          )}
        </div>

        <div className="p-6">
          {activeTab === 'alarms' ? (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={alertStatusFilter}
                    onChange={e => setAlertStatusFilter(e.target.value)}
                    className="text-xs font-bold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 dark:text-white"
                  >
                    <option value="">All Statuses</option>
                    <option value="OPEN">🔴 OPEN</option>
                    <option value="CLOSED">✅ CLOSED</option>
                  </select>
                </div>
                <select
                  value={alertClusterFilter}
                  onChange={e => setAlertClusterFilter(e.target.value)}
                  className="text-xs font-bold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 dark:text-white"
                >
                  <option value="">All Clusters</option>
                  {[...new Set(activeAlerts.map(a => a.clusterName))].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button onClick={fetchActiveAlerts} className="flex items-center px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${alertsLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
                <span className="text-[10px] text-gray-400 ml-auto">Auto-refresh every 30s</span>
              </div>

              {/* Alarm List */}
              {activeAlerts.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No alarms found</p>
                  <p className="text-xs text-gray-400 mt-1">All systems are operating normally.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {activeAlerts.map(alert => (
                    <div key={alert.id} className={`p-4 rounded-xl border ${
                      alert.status === 'OPEN'
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'
                        : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/40'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          {alert.status === 'OPEN' ? (
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg mt-0.5">
                              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                          ) : (
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg mt-0.5">
                              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-sm dark:text-white">
                              {alert.metricType} {alert.comparison} {alert.threshold}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Cluster: <span className="font-bold">{alert.clusterName}</span>
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Opened: {new Date(alert.openedAt).toLocaleString()}
                              {alert.closedAt && (
                                <> · Closed: {new Date(alert.closedAt).toLocaleString()}</>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          <span className={`px-2.5 py-1 text-[10px] font-black rounded-full ${
                            alert.status === 'OPEN'
                              ? 'bg-red-500 text-white'
                              : 'bg-green-500 text-white'
                          }`}>{alert.status}</span>
                          {alert.severity && alert.status === 'OPEN' && (
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              alert.severity === 'CRITICAL'
                                ? 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                : 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                            }`}>{alert.severity}</span>
                          )}
                          <span className="text-[10px] text-gray-400 font-mono">
                            Current: <strong className={alert.status === 'OPEN' ? 'text-red-600' : 'text-green-600'}>{alert.currentValue?.toFixed(2)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'rules' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold dark:text-white">Active Thresholds</h3>
                {!isViewer && (
                  <button onClick={() => {
                    setCurrentRule({
                      metricType: 'CPU_USAGE',
                      comparison: '>',
                      threshold: 80,
                      durationMinutes: 5,
                      clusterName: 'all',
                      status: 'active'
                    });
                    setIsRuleModalOpen(true);
                  }} className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-1" /> New Rule
                  </button>
                )}
              </div>
              <div className="grid gap-4">
                {rules.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No alerting rules defined yet.</p>
                ) : (
                  rules.map(rule => (
                    <div key={rule.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                      <div>
                        <p className="font-medium dark:text-white">{rule.metricType} {rule.comparison} {rule.threshold}%</p>
                        <p className="text-sm text-gray-500">Cluster: {rule.clusterName || 'All'} | Duration: {rule.durationMinutes}m</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs rounded-full font-bold ${(rule.status || 'active') === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                          } ${!isViewer ? 'cursor-pointer hover:bg-red-100 hover:text-red-700' : ''}`} 
                          onClick={() => !isViewer && handleToggleRuleStatus(rule)}>
                          {(rule.status || 'active').toUpperCase()}
                        </span>
                        {!isViewer && (
                          <>
                            <button
                              onClick={() => handleEditRule(rule)}
                              className="text-blue-500 hover:bg-blue-50 p-1 rounded-md text-xs font-bold"
                            >Edit</button>
                            <button
                              onClick={() => api.delete(`/alerts/rules/${rule.id}`).then(() => { fetchData(); toast('Rule deleted', 'success'); }).catch(() => toast('Failed to delete rule', 'error'))}
                              className="text-red-500 hover:bg-red-50 p-1 rounded-md"
                            ><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold dark:text-white">Integrated Channels</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ChannelCard
                    icon={Mail}
                    title="Email"
                    desc="Notify administrators via SMTP."
                    type="EMAIL"
                    channels={channels}
                    onSave={handleSaveChannel}
                    onDelete={handleDeleteChannel}
                    isViewer={isViewer}
                  />
                  <ChannelCard
                    icon={Globe}
                    title="Webhooks"
                    desc="Custom HTTP integration for third-party systems."
                    type="WEBHOOK"
                    channels={channels}
                    onSave={handleSaveChannel}
                    onDelete={handleDeleteChannel}
                    isViewer={isViewer}
                  />
              </div>
            </div>
          )}
        </div>
      </div>

      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-6">
              <h3 className="text-lg font-bold dark:text-white mb-4">{currentRule.id ? 'Edit Alert Rule' : 'Create Alert Rule'}</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Metric Type</label>
                  <select className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                    value={currentRule.metricType} onChange={e => setCurrentRule({ ...currentRule, metricType: e.target.value })}>
                    <option value="CPU_USAGE">CPU Usage (%)</option>
                    <option value="MEMORY_USAGE">Memory Usage (%)</option>
                    <option value="DISK_USAGE">Disk Usage (%)</option>
                    <option value="REPLICATION_LAG">Replication Lag (Bytes)</option>
                    <option value="CONNECTION_COUNT">Connection Count</option>
                    <option value="TRANSACTION_RATE">Transaction Rate (TPS)</option>
                    <option value="WAL_SIZE">WAL Size (MB)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Comparison</label>
                    <select className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                      value={currentRule.comparison} onChange={e => setCurrentRule({ ...currentRule, comparison: e.target.value })}>
                      <option value=">">&gt; (Greater Than)</option>
                      <option value="<">&lt; (Less Than)</option>
                      <option value=">=">&gt;= (Greater or Equal)</option>
                      <option value="<=">&lt;= (Less or Equal)</option>
                      <option value="==">== (Equal)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Threshold Value</label>
                    <input type="number" className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                      value={currentRule.threshold} onChange={e => setCurrentRule({ ...currentRule, threshold: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Duration (Minutes)</label>
                  <input type="number" className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                    value={currentRule.durationMinutes} onChange={e => setCurrentRule({ ...currentRule, durationMinutes: parseInt(e.target.value) || 0 })} />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Target Cluster</label>
                  <select className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                    value={currentRule.clusterName} onChange={e => setCurrentRule({ ...currentRule, clusterName: e.target.value })}>
                    <option value="all">All Clusters</option>
                    {clusters.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setIsRuleModalOpen(false)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                <button onClick={handleSaveRule} className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md shadow-blue-500/20">Save Rule</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ChannelCardProps {
  icon: LucideIcon;
  title: string;
  desc: string;
  type: 'EMAIL' | 'WEBHOOK';
  channels: Channel[];
  onSave: (channel: Partial<Channel>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isViewer: boolean;
}

function ChannelCard({ icon: Icon, title, desc, type, channels, onSave, onDelete, isViewer }: ChannelCardProps) {
  const { toast } = useUI();
  const [isOpen, setIsOpen] = useState(false);
  const activeChannel = channels.find(c => c.channelType === type);

  // Default configs
  const [emailConfig, setEmailConfig] = useState({ toAddresses: '' });
  const [webhookConfig, setWebhookConfig] = useState({ url: '', method: 'POST', headers: '' });

  useEffect(() => {
    if (activeChannel && activeChannel.targetConfig) {
      try {
        const parsed = JSON.parse(activeChannel.targetConfig);
        if (type === 'EMAIL') setEmailConfig({ toAddresses: parsed.toAddresses || '' });
        if (type === 'WEBHOOK') setWebhookConfig({ ...webhookConfig, ...parsed });
      } catch (e) { }
    }
  }, [activeChannel, type]);

  const handleSave = async () => {
    const targetConfig = type === 'EMAIL' ? JSON.stringify(emailConfig) : JSON.stringify(webhookConfig);
    await onSave({
      id: activeChannel?.id,
      channelType: type,
      targetConfig,
      enabled: true
    });
    setIsOpen(false);
  };

  const handleTest = async () => {
    if (!activeChannel) {
      toast('Please save configuration before testing.', 'info');
      return;
    }
    try {
      await api.post(`/alerts/channels/${activeChannel.id}/test`);
      toast('Test alert triggered! Check your inbox/webhook.', 'success');
    } catch (e) {
      toast('Test failed. Please check your settings.', 'error');
    }
  };

  return (
    <>
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 flex flex-col justify-between">
        <div>
          <Icon className="w-8 h-8 mb-3 text-blue-500" />
          <h4 className="font-bold dark:text-white">{title}</h4>
          <p className="text-xs text-gray-500 mt-1">{desc}</p>
        </div>
        <div className="mt-4 flex justify-between items-center">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeChannel?.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
            {activeChannel?.enabled ? 'CONNECTED' : 'NOT CONFIGURED'}
          </span>
          <div className="flex space-x-3">
            {!isViewer && (
              <>
                {activeChannel && (
                  <button onClick={() => onDelete(activeChannel.id)} className="text-xs text-red-500 hover:underline font-bold">Remove</button>
                )}
                <button onClick={() => setIsOpen(true)} className="text-xs text-blue-600 hover:underline font-bold">
                  {activeChannel ? 'Edit Settings' : 'Configure'}
                </button>
              </>
            )}
            {isViewer && (
              <span className="text-[10px] text-gray-400 italic">Read Only</span>
            )}
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-6">
              <h3 className="text-lg font-bold dark:text-white mb-4">Configure {title}</h3>

              <div className="space-y-4">
                {type === 'EMAIL' ? (
                  <>
                    {/* Bug 1 Fix: Use central email config from /settings/email, only ask for recipients */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                        📬 This channel uses the central SMTP server configured on the <strong>Email Settings</strong> page.
                        To change SMTP settings, visit the <a href="/settings/email" className="underline font-bold">Email Config</a> page.
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Recipient Addresses (Separate with commas)</label>
                      <input type="text" className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                        value={emailConfig.toAddresses}
                        onChange={e => setEmailConfig({ toAddresses: e.target.value })}
                        placeholder="admin@domain.com, dba@domain.com" />
                      <p className="text-[10px] text-gray-400 mt-1">Notifications will be sent to these addresses when an alarm is triggered.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Webhook URL</label>
                      <input type="text" className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                        value={webhookConfig.url} onChange={e => setWebhookConfig({ ...webhookConfig, url: e.target.value })} placeholder="https://api.pagerduty.com/... " />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">HTTP Method</label>
                      <select className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                        value={webhookConfig.method} onChange={e => setWebhookConfig({ ...webhookConfig, method: e.target.value })}>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Custom Headers (JSON)</label>
                      <textarea rows={3} className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono dark:text-white"
                        value={webhookConfig.headers} onChange={e => setWebhookConfig({ ...webhookConfig, headers: e.target.value })} placeholder='{"Authorization": "Bearer token"}' />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex space-x-2">
                   <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                   {activeChannel && (
                     <button onClick={handleTest} className="px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg">Test</button>
                   )}
                </div>
                <button onClick={handleSave} className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md shadow-blue-500/20">Save Configuration</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
