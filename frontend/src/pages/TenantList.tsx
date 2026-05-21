import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Trash2, Edit2, Globe, Server, Activity, ArrowRight, ShieldCheck } from 'lucide-react';
import { useTenant } from '../context/TenantContext';
import { useUI } from '../context/UIContext';

export default function TenantList() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [kubeconfig, setKubeconfig] = useState('');
  const [apiServerUrl, setApiServerUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { refreshEnvironments, setActiveEnvironmentId } = useTenant();
  const { toast, confirm } = useUI();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const res = await api.get('/environments');
      setTenants(res.data);
    } catch (err) {
      console.error('Failed to fetch tenants', err);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setNewTenantName('');
    setKubeconfig('');
    setApiServerUrl('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (tenant: any) => {
    setEditingId(tenant.id);
    setNewTenantName(tenant.name);
    setKubeconfig(tenant.kubeconfig || '');
    setApiServerUrl(tenant.apiServerUrl || '');
    setIsModalOpen(true);
  };

  const handleDeleteTenant = async (id: string, name: string) => {
    const ok = await confirm({
        title: 'Delete Tenant',
        message: `Are you sure you want to delete tenant '${name}'? All related environment metadata will be lost.`,
        type: 'danger'
    });
    if (!ok) return;
    try {
      await api.delete(`/environments/${id}`);
      await fetchTenants();
      await refreshEnvironments();
      toast('Tenant deleted successfully', 'success');
    } catch (err) {
      toast('Failed to delete tenant', 'error');
    }
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName) return;
    setSaving(true);
    try {
      const payload = { 
        name: newTenantName, 
        kubeconfig: kubeconfig,
        apiServerUrl: apiServerUrl,
        status: 'active' 
      };

      let createdId = editingId;
      if (editingId) {
        await api.put(`/environments/${editingId}`, payload);
      } else {
        const res = await api.post('/environments', payload);
        createdId = res.data.id;
      }
      
      setIsModalOpen(false);
      await fetchTenants();
      await refreshEnvironments();
      
      if (createdId) {
        await checkOperatorStatus(createdId);
      } else {
        toast(editingId ? 'Tenant updated successfully' : 'Tenant created successfully', 'success');
      }
    } catch (err) {
      toast('Failed to save tenant', 'error');
    } finally {
      setSaving(false);
    }
  };

  const [operatorCheckResult, setOperatorCheckResult] = useState<{installed: boolean, message: string, envId: string} | null>(null);
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkOperatorStatus = async (id: string) => {
    setChecking(true);
    try {
      const res = await api.get(`/environments/${id}/operator-status`);
      setOperatorCheckResult({ ...res.data, envId: id });
      setIsCheckModalOpen(true);
    } catch (err) {
      toast('Could not verify operator status', 'error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-20 w-48 h-48 bg-blue-400 opacity-10 rounded-full blur-[60px] pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
              <Globe className="w-6 h-6 text-blue-200" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight font-outfit text-white">Tenants</h1>
          </div>
          <p className="text-blue-100/70 text-sm max-w-xl leading-relaxed">
            Manage your Multi-Cloud Kubernetes clusters and environments. Each tenant represents an isolated boundary for PostgreSQL deployments.
          </p>
        </div>
        <div className="relative z-10 flex-shrink-0">
          <button 
            onClick={handleOpenCreateModal} 
            className="flex items-center justify-center px-6 py-3 bg-white text-blue-900 hover:bg-blue-50 rounded-xl text-sm font-bold shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4 mr-2" /> Connect New Tenant
          </button>
        </div>
      </div>
      
      {/* Tenants Grid */}
      {tenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-[#0B1120] border border-gray-100 dark:border-gray-800 rounded-3xl shadow-xl text-center">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6">
            <Server className="w-10 h-10 text-blue-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Tenants Found</h3>
          <p className="text-gray-500 max-w-md mx-auto mb-8">You haven't connected any Kubernetes clusters yet. Add your first tenant to start deploying databases.</p>
          <button 
            onClick={handleOpenCreateModal} 
            className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4 mr-2" /> Connect First Tenant
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((tenant, idx) => (
            <div key={idx} className="group relative bg-white dark:bg-[#0B1120] rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:border-blue-500/30 transition-all duration-300 flex flex-col h-full overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500"></div>
              
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                  <Server className="w-6 h-6" />
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => handleOpenEditModal(tenant)} className="p-2 bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-all" title="Edit Configuration">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteTenant(tenant.id, tenant.name)} className="p-2 bg-gray-50 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all" title="Remove Tenant">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 font-outfit">{tenant.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-6 flex items-center">
                  <Globe className="w-3 h-3 mr-1" />
                  {tenant.apiServerUrl || 'Internal Cluster Network'}
                </p>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                   <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Status</p>
                      <div className="flex items-center justify-center space-x-1.5">
                         <span className={`w-2 h-2 rounded-full ${tenant.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                         <span className={`text-xs font-bold ${tenant.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                           {tenant.status?.toUpperCase() || 'ACTIVE'}
                         </span>
                      </div>
                   </div>
                   <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Protection</p>
                      <div className="flex items-center justify-center space-x-1.5 text-indigo-600 dark:text-indigo-400">
                         <ShieldCheck className="w-3.5 h-3.5" />
                         <span className="text-xs font-bold">Enabled</span>
                      </div>
                   </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center mt-auto">
                <span className="text-[10px] text-gray-400 font-medium">Added recently</span>
                <button 
                  onClick={() => {
                    setActiveEnvironmentId(tenant.id);
                    navigate('/clusters');
                  }}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center group-hover:underline"
                >
                   View Clusters <ArrowRight className="w-3 h-3 ml-1 transform group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Premium Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
              <div className="flex items-center">
                 <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl mr-3">
                   {editingId ? <Edit2 className="w-5 h-5" /> : <Server className="w-5 h-5" />}
                 </div>
                 <h3 className="text-xl font-bold dark:text-white font-outfit">{editingId ? 'Edit Tenant Configuration' : 'Register New Tenant'}</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveTenant} className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tenant Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Globe className="h-5 w-5 text-gray-400" />
                  </div>
                  <input 
                    type="text" 
                    autoFocus
                    required
                    value={newTenantName}
                    onChange={e => setNewTenantName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-800 transition-all text-sm" 
                    placeholder="e.g. Acme Corp Prod Cluster"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">API Server URL (Optional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Activity className="h-5 w-5 text-gray-400" />
                  </div>
                  <input 
                    type="url" 
                    value={apiServerUrl}
                    onChange={e => setApiServerUrl(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-800 transition-all text-sm" 
                    placeholder="https://k8s-api.example.com"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kubeconfig Context (YAML)</label>
                <div className="relative group">
                  <textarea 
                    required={!editingId}
                    rows={6}
                    value={kubeconfig}
                    onChange={e => setKubeconfig(e.target.value)}
                    className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-800 transition-all font-mono text-xs custom-scrollbar resize-none" 
                    placeholder={editingId ? "Leave blank to keep existing kubeconfig..." : "apiVersion: v1\nclusters:\n- cluster:\n    server: ..."}
                  />
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="bg-gray-800 text-white text-[10px] px-2 py-1 rounded">Paste YAML</span>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving || !newTenantName || (!editingId && !kubeconfig)} className="flex items-center px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                  {saving ? (
                    <><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving...</>
                  ) : (
                    <>{editingId ? 'Update Connection' : 'Establish Connection'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Operator Status Modal */}
      {isCheckModalOpen && operatorCheckResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300 p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 duration-400">
            <div className={`p-8 ${operatorCheckResult.installed ? 'bg-emerald-500/10' : 'bg-amber-500/10'} border-b border-gray-100 dark:border-gray-800`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-4 rounded-2xl ${operatorCheckResult.installed ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {operatorCheckResult.installed ? <ShieldCheck className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black dark:text-white font-outfit leading-tight">
                      {operatorCheckResult.installed ? 'Operator Ready' : 'Installation Required'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                      CloudNativePG Stack Verification
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsCheckModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-8">
              {operatorCheckResult.installed ? (
                <div className="space-y-6">
                  <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-3xl">
                    <p className="text-emerald-800 dark:text-emerald-300 text-sm leading-relaxed">
                      Excellent! We detected the <strong>CloudNativePG Operator</strong> in your cluster. 
                      You can now proceed to deploy highly available PostgreSQL clusters, managed backups, and monitoring agents.
                    </p>
                  </div>
                  <div className="flex justify-end pt-4">
                    <button 
                      onClick={() => {
                        setActiveEnvironmentId(operatorCheckResult.envId);
                        navigate('/clusters');
                      }}
                      className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-black shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
                    >
                      Go to Clusters <ArrowRight className="w-4 h-4 ml-2 inline" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-3xl">
                    <p className="text-amber-800 dark:text-amber-300 text-sm leading-relaxed">
                      The <strong>CloudNativePG Operator</strong> is not found in this cluster. 
                      To use this platform, you must install the operator first. Use the commands below:
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="group relative">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Step 1: Install Operator via Kubectl</label>
                      <div className="bg-gray-950 rounded-2xl p-4 font-mono text-xs text-blue-400 overflow-x-auto border border-white/5 relative group">
                        <code>kubectl apply --server-side -f https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/main/releases/cnpg-1.22.1.yaml</code>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText('kubectl apply --server-side -f https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/main/releases/cnpg-1.22.1.yaml');
                            toast('Command copied to clipboard!', 'success');
                          }}
                          className="absolute top-3 right-3 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                        </button>
                      </div>
                    </div>

                    <div className="group relative">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Step 2: Verify Installation</label>
                      <div className="bg-gray-950 rounded-2xl p-4 font-mono text-xs text-emerald-400 overflow-x-auto border border-white/5">
                        <code>kubectl get deployment -n cnpg-system cnpg-controller-manager</code>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-6 border-t border-gray-100 dark:border-gray-800">
                    <button onClick={() => checkOperatorStatus(operatorCheckResult.envId)} className="flex items-center text-blue-600 font-bold text-sm hover:underline">
                      <RefreshCw className={`w-4 h-4 mr-2 ${checking ? 'animate-spin' : ''}`} /> Re-verify Now
                    </button>
                    <button onClick={() => setIsCheckModalOpen(false)} className="px-8 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl text-sm font-black transition-all hover:bg-gray-200">
                      Configure Later
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add RefreshCw icon to imports if not there
import { RefreshCw, AlertTriangle } from 'lucide-react';

