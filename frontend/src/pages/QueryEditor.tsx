import React, { useState, useEffect } from 'react';
import { Database, Play, Save, Trash2, Download, Plus, X, Loader2, Table as TableIcon, AlertCircle, Clock, History, Search, ChevronRight, ChevronDown, Filter, Columns, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import { useTenant } from '../context/TenantContext';
import { useUI } from '../context/UIContext';

interface QueryTab {
  id: number;
  name: string;
  content: string;
}

interface ClusterNode {
  name: string;
  namespace: string;
  databases: string[];
  isOpen: boolean;
}

export default function QueryEditor() {
  const { activeEnvironmentId } = useTenant();
  const { toast } = useUI();
  const [tabs, setTabs] = useState<QueryTab[]>([{ id: 1, name: 'Query 1', content: 'SELECT * FROM pg_tables LIMIT 10;' }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [results, setResults] = useState<any[]>([]);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [execTime, setExecTime] = useState<number | null>(null);
  
  // Sidebar state
  const [clusters, setClusters] = useState<ClusterNode[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<{name: string, namespace: string} | null>(null);
  const [selectedDb, setSelectedDb] = useState<string>('postgres');
  const [tables, setTables] = useState<string[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(false);

  const activeTab = tabs.find(t => t.id === activeTabId);

  useEffect(() => {
    fetchClusters();
  }, [activeEnvironmentId]);

  const fetchClusters = async () => {
    setSidebarLoading(true);
    try {
      const res = await api.get('/clusters');
      const nodes = (res.data || []).map((c: any) => ({
        name: c.name,
        namespace: c.namespace,
        databases: [],
        isOpen: false
      }));
      setClusters(nodes);
    } catch (err) {
      toast('Failed to load clusters', 'error');
    } finally {
      setSidebarLoading(false);
    }
  };

  const toggleCluster = async (index: number) => {
    const newClusters = [...clusters];
    const cluster = newClusters[index];
    cluster.isOpen = !cluster.isOpen;
    
    if (cluster.isOpen && cluster.databases.length === 0) {
      try {
        const res = await api.get(`/query/databases?namespace=${cluster.namespace}&clusterName=${cluster.name}`);
        cluster.databases = res.data || [];
      } catch (err) {
        toast('Failed to load databases', 'error');
      }
    }
    setClusters(newClusters);
    setSelectedCluster({name: cluster.name, namespace: cluster.namespace});
  };

  const selectDatabase = async (cluster: ClusterNode, db: string) => {
    setSelectedCluster({name: cluster.name, namespace: cluster.namespace});
    setSelectedDb(db);
    try {
      const res = await api.get(`/query/tables?namespace=${cluster.namespace}&clusterName=${cluster.name}&database=${db}`);
      setTables(res.data || []);
      toast(`Connected to ${db}`, 'info');
    } catch (err) {
      toast('Failed to load tables', 'error');
    }
  };

  const addTab = () => {
    const newId = Math.max(0, ...tabs.map(t => t.id)) + 1;
    setTabs([...tabs, { id: newId, name: `Query ${newId}`, content: '' }]);
    setActiveTabId(newId);
  };

  const removeTab = (id: number) => {
    if (tabs.length === 1) return;
    const filtered = tabs.filter(t => t.id !== id);
    setTabs(filtered);
    if (activeTabId === id) setActiveTabId(filtered[0].id);
  };

  const handleRun = async () => {
    if (!activeTab?.content.trim() || !selectedCluster) {
        if (!selectedCluster) toast('Please select a database from the sidebar', 'error');
        return;
    }
    setLoading(true);
    setQueryError(null);
    const start = Date.now();
    try {
      const res = await api.post('/query/execute', {
        query: activeTab.content,
        clusterName: selectedCluster.name,
        namespace: selectedCluster.namespace,
        database: selectedDb
      });
      setExecTime(Date.now() - start);
      setResults(res.data || []);
    } catch (err: any) {
      setQueryError(err.response?.data?.error || err.message || 'Query execution failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-white dark:bg-[#020617] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      
      {/* DB Explorer Sidebar */}
      <aside className="w-72 border-r border-gray-100 dark:border-gray-800 flex flex-col bg-gray-50/50 dark:bg-gray-900/20">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Explorer</h2>
            <button onClick={fetchClusters} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${sidebarLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search tables..." className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {clusters.map((cluster, idx) => (
            <div key={cluster.name} className="space-y-1">
              <button 
                onClick={() => toggleCluster(idx)}
                className={`w-full flex items-center px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedCluster?.name === cluster.name ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              >
                {cluster.isOpen ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
                <Database className="w-4 h-4 mr-2 text-indigo-500" />
                {cluster.name}
              </button>
              
              {cluster.isOpen && (
                <div className="ml-6 space-y-1 border-l border-gray-200 dark:border-gray-800 pl-4">
                  {cluster.databases.map(db => (
                    <div key={db} className="space-y-1">
                        <button 
                            onClick={() => selectDatabase(cluster, db)}
                            className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] transition-all ${selectedDb === db && selectedCluster?.name === cluster.name ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            {db}
                        </button>
                        {selectedDb === db && selectedCluster?.name === cluster.name && tables.length > 0 && (
                            <div className="ml-2 space-y-0.5">
                                {tables.map(t => (
                                    <div key={t} className="flex items-center px-2 py-1 text-[10px] text-gray-400 hover:text-blue-500 cursor-pointer">
                                        <TableIcon className="w-3 h-3 mr-2 opacity-50" />
                                        {t}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Editor & Results Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Toolbar */}
        <div className="h-14 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-6 bg-white dark:bg-gray-900">
          <div className="flex items-center space-x-1">
            {tabs.map(tab => (
              <div key={tab.id} onClick={() => setActiveTabId(tab.id)}
                className={`group flex items-center px-4 py-2 text-xs font-bold cursor-pointer rounded-t-xl transition-all border-b-2 ${activeTabId === tab.id ? 'border-blue-600 text-blue-600 bg-blue-50/30 dark:bg-blue-900/10' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
                {tab.name}
                <X onClick={(e) => { e.stopPropagation(); removeTab(tab.id); }} className="w-3 h-3 ml-3 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all" />
              </div>
            ))}
            <button onClick={addTab} className="p-2 text-gray-400 hover:text-blue-500 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
             <div className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700">
                {selectedCluster?.name || 'No DB Selected'}.{selectedDb}
             </div>
             <button onClick={handleRun} disabled={loading || !selectedCluster} className="flex items-center px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50">
               {loading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-2" />} 
               Execute
             </button>
          </div>
        </div>

        {/* Query Editor */}
        <div className="flex-1 relative bg-white dark:bg-[#0B1120]">
          <textarea
            className="w-full h-full p-8 font-mono text-sm bg-transparent border-none resize-none focus:outline-none text-gray-700 dark:text-blue-300 leading-relaxed custom-scrollbar"
            spellCheck={false}
            value={activeTab?.content}
            onChange={(e) => {
              const newTabs = tabs.map(t => t.id === activeTabId ? { ...t, content: e.target.value } : t);
              setTabs(newTabs);
            }}
            placeholder="-- Write your SQL query here
SELECT * FROM my_table LIMIT 100;"
          />
        </div>

        {/* Results Pane */}
        <div className="h-[40%] border-t border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900">
          <div className="flex justify-between items-center px-6 py-2 bg-gray-50/50 dark:bg-gray-950/50 text-[10px] font-bold text-gray-500 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center space-x-6">
              <span className="flex items-center text-blue-600">
                <Clock className="w-3 h-3 mr-1.5" />
                {execTime !== null ? `${execTime}ms` : 'Ready'}
              </span>
              <span className="flex items-center">
                <Filter className="w-3 h-3 mr-1.5" />
                {results.length} rows returned
              </span>
            </div>
            <div className="flex items-center space-x-3">
                <button className="hover:text-blue-600 transition-colors flex items-center">
                    <Download className="w-3 h-3 mr-1" /> Export
                </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto custom-scrollbar">
            {queryError ? (
              <div className="flex items-start p-6 bg-red-50/50 dark:bg-red-950/20 m-6 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-sm">
                <AlertCircle className="w-5 h-5 text-red-500 mr-4 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <h4 className="text-xs font-bold text-red-800 dark:text-red-300">Query Execution Error</h4>
                    <p className="text-xs text-red-600 dark:text-red-400 font-mono leading-relaxed">{queryError}</p>
                </div>
              </div>
            ) : results.length > 0 ? (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-950 sticky top-0 z-10">
                  <tr>
                    {Object.keys(results[0]).map(key => (
                      <th key={key} className="px-4 py-3 font-bold text-gray-500 border-b border-r border-gray-100 dark:border-gray-800 uppercase tracking-widest text-[9px]">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {results.map((row, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                      {Object.values(row).map((val: any, i) => (
                        <td key={i} className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-mono border-r border-gray-100 dark:border-gray-800 max-w-[300px] truncate">{String(val)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4 opacity-50">
                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-3xl">
                    <TableIcon className="w-12 h-12" />
                </div>
                <p className="text-xs font-medium tracking-wide">
                    {execTime !== null ? 'The query executed successfully but returned no results.' : 'Connect to a cluster and run a query to view data.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
