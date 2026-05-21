import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Search, Shield, User, Activity, Globe, RefreshCw } from 'lucide-react';
import { useTenant } from '../context/TenantContext';

export default function AuditLogs() {
  const { activeEnvironmentId } = useTenant();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit');
      setLogs(res.data || []);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, activeEnvironmentId]);

  const filteredLogs = logs.filter(log => 
    (log.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (log.action || '').toLowerCase().includes(search.toLowerCase()) ||
    (log.resourceName || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white font-outfit">Audit Logs</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Compliance and security event history.</p>
        </div>
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center bg-gray-50/30 dark:bg-gray-900/30">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search logs..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="ml-auto flex space-x-2">
             <button onClick={fetchLogs} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
             </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full compact-table">
            <thead>
              <tr>
                <th className="text-left">User</th>
                <th className="text-left">Action</th>
                <th className="text-left">Resource</th>
                <th className="text-left">Source IP</th>
                <th className="text-left">Status</th>
                <th className="text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {loading ? (
                 <tr>
                   <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                     <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-20" />
                     Loading audit logs...
                   </td>
                 </tr>
              ) : paginatedLogs.length === 0 ? (
                 <tr>
                   <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                     <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
                     No audit events found.
                   </td>
                 </tr>
              ) : (
                paginatedLogs.map((log, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                    <td>
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {log.username || log.userEmail || 'system'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <Activity className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">{log.action}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-sm text-gray-500">
                        {log.resourceType && <span className="font-bold text-gray-700 dark:text-gray-300">{log.resourceType}</span>}
                        {log.resourceName && <span className="ml-1 text-gray-400">/ {log.resourceName}</span>}
                        {!log.resourceType && !log.resourceName && '—'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center space-x-1 text-xs text-gray-500 font-mono">
                        <Globe className="w-3 h-3" />
                        <span>{log.sourceIp || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' :
                        log.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {log.status || 'INFO'}
                      </span>
                    </td>
                    <td className="text-right text-xs text-gray-400 font-mono">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/30 dark:bg-gray-900/30">
            <span className="text-xs text-gray-500">
              Showing <span className="font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold">{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</span> of <span className="font-bold">{filteredLogs.length}</span> entries
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
