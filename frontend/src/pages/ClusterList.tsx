import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Plus, Search, MoreVertical, Terminal, Settings2, RefreshCcw, Database, Server, HardDrive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';

export default function ClusterList() {
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast, confirm, prompt } = useUI();
  const { user } = useAuth();
  const { activeEnvironmentId } = useTenant();

  const isViewer = user?.role?.toUpperCase() === 'VIEWER';

  const filteredClusters = clusters.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filteredClusters.length / itemsPerPage);
  const paginatedClusters = filteredClusters.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/clusters');
      setClusters(res.data);
    } catch (err) {
      console.error('Failed to fetch clusters', err);
      toast('Failed to fetch clusters', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters, activeEnvironmentId]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white font-outfit">PostgreSQL Clusters</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and monitor your CloudNative-PG deployments.</p>
        </div>
        {!isViewer && (
          <Link to="/clusters/new" className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95">
            <Plus className="w-4 h-4 mr-2" /> New Cluster
          </Link>
        )}
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center bg-gray-50/30 dark:bg-gray-900/30">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search clusters..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="ml-auto flex space-x-2">
             <button onClick={fetchClusters} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
             </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full compact-table">
            <thead>
              <tr>
                <th className="text-left">Cluster Name</th>
                <th className="text-left">Namespace</th>
                <th className="text-left">Status</th>
                <th className="text-left">Instances</th>
                <th className="text-left">Storage</th>
                <th className="text-left">Version</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  <RefreshCcw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-20" />
                  Loading clusters...
                </td></tr>
              ) : paginatedClusters.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  No clusters found
                </td></tr>
              )}
              {paginatedClusters.map((c, i) => {
                const isHibernating = c.metadata?.annotations?.['cnpg.io/hibernation'] === 'on';
                const phase = c.status?.phase || 'Unknown';
                const isHealthy = phase === 'Cluster in healthy state' && !isHibernating;
                const readyInstances = c.status?.readyInstances || 0;
                const totalInstances = c.spec?.instances || 0;
                const version = c.spec?.imageName ? c.spec.imageName.split(':')[1] : 'PG';
                
                return (
                  <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="font-bold text-gray-900 dark:text-white">
                      <Link to={`/clusters/${c.namespace}/${c.name}`} className="hover:text-blue-600 transition-colors">{c.name}</Link>
                    </td>
                    <td className="text-sm text-gray-500 font-mono">{c.namespace}</td>
                    <td>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isHealthy ? 'bg-emerald-100 text-emerald-700' : 
                        isHibernating ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
                          isHealthy ? 'bg-emerald-500' : 
                          isHibernating ? 'bg-slate-400' : 'bg-amber-500'
                        }`}></span>
                        {isHibernating ? 'HIBERNATING' : (typeof phase === 'string' ? phase : 'READY')}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center text-xs dark:text-white font-bold">
                        <Server className="w-3 h-3 mr-1.5 text-blue-500" />
                        {readyInstances}/{totalInstances}
                      </div>
                    </td>
                    <td>
                       <div className="flex items-center text-xs text-gray-500">
                         <HardDrive className="w-3 h-3 mr-1.5" />
                         {c.spec?.storage?.size || 'N/A'}
                       </div>
                    </td>
                    <td>
                       <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-bold text-gray-600 dark:text-gray-400">
                         {version}
                       </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {!isViewer && (
                          <button 
                              title="Resize Storage" 
                              onClick={async () => {
                                const newSize = await prompt({ 
                                  title: 'Resize Storage', 
                                  message: `Enter new storage size for ${c.name} (e.g., 20Gi):`, 
                                  defaultValue: c.spec?.storage?.size 
                                });
                                if (newSize) {
                                  const ok = await confirm({
                                      title: 'Confirm Resize',
                                      message: `Are you sure you want to resize storage for ${c.name} to ${newSize}? This action is irreversible once the PVC expands.`,
                                      type: 'danger'
                                  });
                                  if (!ok) return;

                                  api.post(`/clusters/${c.namespace}/${c.name}/resize`, { newSize: newSize })
                                    .then(() => toast('Resize request sent successfully!', 'success'))
                                    .catch(err => toast('Resize failed.', 'error'));
                                }
                              }}
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                           >
                              <HardDrive className="w-4 h-4" />
                           </button>
                        )}
                        <Link title="Manage" to={`/clusters/${c.namespace}/${c.name}`} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                          <Settings2 className="w-4 h-4" />
                        </Link>
                        {!isViewer && (
                          <Link title="SQL Console" to="/query" className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors">
                            <Terminal className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
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
              Showing <span className="font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold">{Math.min(currentPage * itemsPerPage, filteredClusters.length)}</span> of <span className="font-bold">{filteredClusters.length}</span> clusters
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
  );
}
