import React, { useState, useEffect } from 'react';
import { Database, Plus, Trash2, ShieldCheck, Clock, Search, RefreshCw, AlertCircle, HardDrive } from 'lucide-react';
import api from '../api/axios';
import { useTenant } from '../context/TenantContext';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';

interface Backup {
  name: string;
  cluster?: string;
  namespace?: string;
  status?: any;
  creationTimestamp?: string;
}

interface ClusterRef {
  name: string;
  namespace: string;
}

export default function BackupList() {
  const { activeEnvironmentId } = useTenant();
  const { toast, confirm } = useUI();
  const { user } = useAuth();
  const [backups, setBackups] = useState<Backup[]>([]);
  
  const isViewer = user?.role?.toUpperCase() === 'VIEWER';
  const [clusters, setClusters] = useState<ClusterRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newBackupCluster, setNewBackupCluster] = useState('');
  const [newBackupNamespace, setNewBackupNamespace] = useState('default');
  const [filterNamespace, setFilterNamespace] = useState('all');
  const [filterCluster, setFilterCluster] = useState('all');
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreData, setRestoreData] = useState({ sourceCluster: '', newName: '', time: '', namespace: '' });

  const fetchData = async () => {
    if (!activeEnvironmentId) return;
    try {
      setLoading(true);
      
      // Fetch Backups
      const backupsRes = await api.get('/backups');
      setBackups(backupsRes.data || []);
      
      // Fetch Clusters for selection
      const clustersRes = await api.get('/clusters');
      const clusterList = clustersRes.data || [];
      setClusters(clusterList);
      
      if (clusterList.length > 0 && !newBackupCluster) {
        setNewBackupCluster(clusterList[0].name);
        setNewBackupNamespace(clusterList[0].namespace);
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeEnvironmentId]);

  const handleClusterChange = (clusterName: string) => {
    setNewBackupCluster(clusterName);
    const selected = clusters.find(c => c.name === clusterName);
    if (selected) {
      setNewBackupNamespace(selected.namespace);
    }
  };

  const handleCreateBackup = async () => {
    if (!newBackupCluster) {
      alert('Please select a cluster');
      return;
    }
    try {
      await api.post('/backups', 
        { clusterName: newBackupCluster, backupName: `manual-backup-${Date.now()}` },
        { headers: { 'X-Namespace': newBackupNamespace } }
      );
      alert('Backup creation triggered!');
      toast('Backup creation triggered!');
      fetchData();
    } catch (err: any) {
      toast(`Failed to create backup: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  const handleDeleteBackup = async (backupName: string, namespace: string) => {
    const ok = await confirm({
        title: 'Delete Backup',
        message: `Are you sure you want to delete backup '${backupName}'? This action is irreversible.`,
        type: 'danger'
    });
    if (!ok) return;
    try {
      await api.delete(`/backups/${backupName}`, { headers: { 'X-Namespace': namespace } });
      toast('Backup deleted successfully');
      fetchData();
    } catch (err) {
      toast('Failed to delete backup', 'error');
    }
  };

  const handleRestore = async () => {
    if (!restoreData.sourceCluster) {
      toast('Source cluster name is missing from backup data. Cannot proceed with restore.', 'error');
      return;
    }
    if (!restoreData.newName) {
      toast('Please enter a name for the new cluster', 'error');
      return;
    }
    try {
      await api.post('/backups/restore/pitr', {
        sourceClusterName: restoreData.sourceCluster,
        newClusterName: restoreData.newName,
        targetTime: restoreData.time
      }, { headers: { 'X-Namespace': restoreData.namespace } });
      toast('Restore operation initiated', 'success');
      setIsRestoreModalOpen(false);
    } catch (err: any) {
      toast(`Restore failed: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredBackups = backups.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase()) || 
                          b.cluster?.toLowerCase().includes(search.toLowerCase());
    const matchesNamespace = filterNamespace === 'all' || b.namespace === filterNamespace;
    const matchesCluster = filterCluster === 'all' || b.cluster === filterCluster;
    return matchesSearch && matchesNamespace && matchesCluster;
  });

  const totalPages = Math.ceil(filteredBackups.length / itemsPerPage);
  const paginatedBackups = filteredBackups.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white font-outfit text-glow">Data Backups</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and monitor your PostgreSQL snapshots across environments.</p>
        </div>
        <div className="flex space-x-2">
           <button onClick={fetchData} className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-gray-50 transition-all shadow-sm">
             <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {!isViewer && (
          <div className="lg:col-span-1 space-y-6">
            <div className="enterprise-card p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none shadow-xl shadow-blue-500/20">
              <h3 className="text-lg font-bold mb-4">Manual Backup</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase opacity-80 mb-1 block">Select Cluster</label>
                  <select 
                    value={newBackupCluster} 
                    onChange={e => handleClusterChange(e.target.value)} 
                    className="w-full p-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white outline-none focus:bg-white/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="" className="text-gray-900">Choose a cluster...</option>
                    {clusters.map(c => (
                      <option key={`${c.namespace}/${c.name}`} value={c.name} className="text-gray-900">
                        {c.name} ({c.namespace})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase opacity-80 mb-1 block">Namespace</label>
                  <input 
                    type="text" 
                    readOnly
                    value={newBackupNamespace} 
                    className="w-full p-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white/70 outline-none cursor-not-allowed" 
                  />
                </div>
                <button 
                  onClick={handleCreateBackup} 
                  disabled={!newBackupCluster || loading}
                  className="w-full py-3 bg-white text-blue-600 rounded-xl text-sm font-bold shadow-lg hover:bg-blue-50 transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 mr-2" /> Start Snapshot
                </button>
              </div>
            </div>

            <div className="enterprise-card p-6">
               <h3 className="text-sm font-bold dark:text-white mb-4 flex items-center">
                 <ShieldCheck className="w-4 h-4 mr-2 text-emerald-500" /> Retention Policy
               </h3>
               <p className="text-xs text-gray-500 leading-relaxed">
                 Default retention for manual backups is set to 30 days. Scheduled backups follow the cluster definition policy.
               </p>
            </div>
          </div>
        )}

        <div className={`${isViewer ? 'lg:col-span-4' : 'lg:col-span-3'} space-y-4`}>
          <div className="enterprise-card p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center bg-gray-50/30 dark:bg-gray-900/30">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search by backup name..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="ml-auto flex items-center space-x-3">
                 <select value={filterNamespace} onChange={e => setFilterNamespace(e.target.value)} className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold outline-none">
                    <option value="all">All Namespaces</option>
                    {[...new Set(backups.map(b => b.namespace))].filter(Boolean).map(ns => (
                      <option key={ns} value={ns}>{ns}</option>
                    ))}
                 </select>
                 <select value={filterCluster} onChange={e => setFilterCluster(e.target.value)} className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold outline-none">
                    <option value="all">All Clusters</option>
                    {[...new Set(backups.map(b => b.cluster))].filter(Boolean).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                 </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full compact-table">
                <thead>
                  <tr>
                    <th className="text-left">Backup Name</th>
                    <th className="text-left">Cluster</th>
                    <th className="text-left">Created</th>
                    <th className="text-left">Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {loading && (
                    <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading data...</td></tr>
                  )}
                  {!loading && paginatedBackups.length === 0 && (
                    <tr><td colSpan={5} className="py-12 text-center text-gray-400">No backups found.</td></tr>
                  )}
                  {paginatedBackups.map((b, i) => {
                    const phase = b.status?.phase || 'Unknown';
                    const error = b.status?.error || '';
                    const isCompleted = phase.toLowerCase() === 'completed';
                    const isFailed = phase.toLowerCase() === 'failed' || error;
                    
                    return (
                      <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                        <td className="font-bold text-gray-900 dark:text-white">
                          <div className="flex items-center">
                            <HardDrive className="w-3.5 h-3.5 mr-2 text-blue-500" />
                            {b.name}
                          </div>
                        </td>
                        <td className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                          {b.cluster || 'N/A'}
                        </td>
                        <td className="text-xs text-gray-500">
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1.5" />
                            {b.creationTimestamp ? new Date(b.creationTimestamp).toLocaleString() : 'N/A'}
                          </div>
                        </td>
                        <td>
                          <div className="group relative inline-block">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                              isCompleted ? 'bg-emerald-100 text-emerald-700' : 
                              isFailed ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              <span className={`w-1 h-1 rounded-full mr-1.5 ${
                                isCompleted ? 'bg-emerald-500' : 
                                isFailed ? 'bg-red-500' : 'bg-amber-500'
                              }`}></span>
                              {phase.toUpperCase()}
                            </span>
                            {error && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                                <p className="font-bold mb-1 text-red-400">Error Details:</p>
                                {error}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="text-right space-x-2">
                          {!isViewer && (
                            <>
                              <button 
                                onClick={() => {
                                  setRestoreData({ sourceCluster: b.cluster || '', newName: `${b.cluster}-restored`, time: '', namespace: b.namespace || 'default' });
                                  setIsRestoreModalOpen(true);
                                }}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                title="Restore / PITR"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteBackup(b.name, b.namespace || 'default')} 
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/30 dark:bg-gray-900/30">
                <span className="text-xs text-gray-500">
                  Showing <span className="font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold">{Math.min(currentPage * itemsPerPage, filteredBackups.length)}</span> of <span className="font-bold">{filteredBackups.length}</span> backups
                </span>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-30"
                  >
                    Previous
                  </button>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isRestoreModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold dark:text-white mb-2">Restore Cluster</h2>
            <p className="text-sm text-gray-500 mb-6">Create a new cluster from source: <span className="font-bold text-blue-600">{restoreData.sourceCluster}</span></p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">New Cluster Name</label>
                <input type="text" value={restoreData.newName} onChange={e => setRestoreData({...restoreData, newName: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Target Time (Optional PITR)</label>
                <input type="text" placeholder="2024-04-27T15:30:00Z" value={restoreData.time} onChange={e => setRestoreData({...restoreData, time: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-mono" />
                <p className="text-[10px] text-gray-400 mt-1">Format: YYYY-MM-DDTHH:mm:ssZ (RFC3339)</p>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button onClick={() => setIsRestoreModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition-all">Cancel</button>
                <button onClick={handleRestore} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all">Restore</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
