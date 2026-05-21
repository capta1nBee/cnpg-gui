import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Database, Activity, Box, Terminal, BarChart3, HardDrive, Trash2, ChevronLeft, ExternalLink, RefreshCw, Scale, Zap, ShieldCheck, type LucideIcon, Loader2, AlertCircle, Play, Square, ArrowLeftRight, Settings, Users, Lock, Layers, CheckCircle, Download } from 'lucide-react';
import api from '../api/axios';
import { useTenant } from '../context/TenantContext';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';

export default function ClusterDetail() {
  const { namespace, name } = useParams();
  const { activeEnvironmentId } = useTenant();
  const { toast, confirm } = useUI();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const isViewer = user?.role?.toUpperCase() === 'VIEWER';
  const [cluster, setCluster] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [scaleInstances, setScaleInstances] = useState(3);
  const [upgradeVersion, setUpgradeVersion] = useState('16');
  
  const [selectedPodForLogs, setSelectedPodForLogs] = useState<string>('');
  const [logs, setLogs] = useState<string>('Select a pod to view logs...');
  const [fetchingLogs, setFetchingLogs] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [hbaRules, setHbaRules] = useState<string[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '' });
  const [isEditingHba, setIsEditingHba] = useState(false);
  const [hbaText, setHbaText] = useState('');
  const [newStorageSize, setNewStorageSize] = useState<string>('');
  const [pooler, setPooler] = useState<any>(null);
  const [managedRoles, setManagedRoles] = useState<any[]>([]);
  const [isEditingRoles, setIsEditingRoles] = useState(false);
  
  const [pgDumpState, setPgDumpState] = useState<'idle' | 'running' | 'completed'>('idle');
  const [pgDumpLogs, setPgDumpLogs] = useState('');
  const [selectedDbForDump, setSelectedDbForDump] = useState('app');
  const [availableDbs, setAvailableDbs] = useState<string[]>([]);
  const [fetchingDbs, setFetchingDbs] = useState(false);
  const [troubleshootView, setTroubleshootView] = useState<'logs' | 'shell'>('logs');
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<any>(null);
  const [terminalConnected, setTerminalConnected] = useState(false);

  const fetchClusterDetail = async () => {
    if (!activeEnvironmentId || !name) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/clusters/${namespace}/${name}`);
      setCluster(res.data);
      setScaleInstances(res.data.spec?.instances || 3);
      setHbaRules(res.data.spec?.postgresql?.pg_hba || []);
      setHbaText((res.data.spec?.postgresql?.pg_hba || []).join('\n'));
      
      if (res.data.status?.instanceNames?.length > 0 && !selectedPodForLogs) {
        setSelectedPodForLogs(res.data.status.instanceNames[0]);
      }
      
      const roles = res.data.spec?.managed?.roles || [];
      setManagedRoles(roles.map((r: any) => ({
        ...r,
        ensure: r.ensure || 'present',
        login: r.login ?? true,
        superuser: r.superuser ?? false,
        inherit: r.inherit ?? true
      })));
      
      // Fetch users and roles from new enhanced endpoint
      const usersRes = await api.get(`/clusters/${namespace}/${name}/users-roles`);
      setUsers(usersRes.data.secretUsers || []);

      // Fetch pooler info
      try {
        const poolerRes = await api.get(`/clusters/${namespace}/${name}/pooler`);
        setPooler(poolerRes.data);
      } catch (err) {
        console.warn('Failed to fetch pooler info', err);
      }

      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch cluster detail', err);
      setError(err.response?.data?.message || 'Failed to load cluster details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClusterDetail();
  }, [namespace, name, activeEnvironmentId]);

  // pg_dump Polling logic
  useEffect(() => {
    let interval: any;
    if (pgDumpState === 'running') {
      interval = setInterval(async () => {
         const targetPod = cluster?.status?.currentPrimary || name + '-1';
         try {
           const res = await api.get(`/clusters/${namespace}/${name}/pg_dump/${targetPod}/status`);
           if (res.data.status === 'COMPLETED') {
             setPgDumpState('completed');
             setPgDumpLogs(prev => prev + '\npg_dump finished successfully. File ready for download.');
             clearInterval(interval);
           } else if (res.data.status === 'RUNNING' || res.data.status === 'IDLE') {
             // Append dot to show progress
             setPgDumpLogs(prev => prev + '.');
           }
         } catch (err) {
           console.error('Polling error', err);
         }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [pgDumpState, cluster, namespace, name]);

  // Interactive Terminal via xterm.js + WebSocket
  useEffect(() => {
    if (troubleshootView !== 'shell' || !cluster || !activeEnvironmentId) return;
    
    let destroyed = false;
    let ws: WebSocket | null = null;
    let term: any = null;
    let fitAddon: any = null;

    const initTerminal = async () => {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      await import('@xterm/xterm/css/xterm.css');

      if (destroyed || !terminalRef.current) return;

      term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
        theme: {
          background: '#020617',
          foreground: '#34d399',
          cursor: '#34d399',
          selectionBackground: '#34d39940',
          black: '#0f172a',
          red: '#f87171',
          green: '#34d399',
          yellow: '#fbbf24',
          blue: '#60a5fa',
          magenta: '#c084fc',
          cyan: '#22d3ee',
          white: '#e2e8f0',
        },
        allowProposedApi: true,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      
      // Small delay to ensure container is sized
      setTimeout(() => {
        if (!destroyed) fitAddon.fit();
      }, 100);

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Build WebSocket URL
      const token = localStorage.getItem('token') || '';
      const targetPod = cluster.status?.currentPrimary || name + '-1';
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/exec-terminal?token=${encodeURIComponent(token)}&namespace=${encodeURIComponent(namespace || '')}&pod=${encodeURIComponent(targetPod)}&env=${encodeURIComponent(activeEnvironmentId || '')}`;

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (destroyed) return;
        setTerminalConnected(true);
        // Send initial resize
        const dims = fitAddon.proposeDimensions();
        if (dims) {
          ws?.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
        }
      };

      ws.onmessage = (event) => {
        if (destroyed || !term) return;
        term.write(event.data);
      };

      ws.onerror = () => {
        if (destroyed || !term) return;
        term.write('\r\n\x1b[31m[Connection error]\x1b[0m\r\n');
        setTerminalConnected(false);
      };

      ws.onclose = () => {
        if (destroyed || !term) return;
        term.write('\r\n\x1b[33m[Session ended]\x1b[0m\r\n');
        setTerminalConnected(false);
      };

      // Forward keystrokes to WebSocket
      term.onData((data: string) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      // Handle terminal resize
      const handleResize = () => {
        if (!destroyed && fitAddon) {
          fitAddon.fit();
          const dims = fitAddon.proposeDimenamespaceionamespace();
          if (dims && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
          }
        }
      };

      window.addEventListener('resize', handleResize);

      // Store cleanup for resize listener
      (term as any)._resizeCleanup = () => window.removeEventListener('resize', handleResize);
    };

    initTerminal().catch(err => console.error('Terminal init failed:', err));

    return () => {
      destroyed = true;
      setTerminalConnected(false);
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
      wsRef.current = null;
      if (xtermRef.current) {
        if ((xtermRef.current as any)._resizeCleanup) {
          (xtermRef.current as any)._resizeCleanup();
        }
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      fitAddonRef.current = null;
    };
  }, [troubleshootView, cluster, activeEnvironmentId, namespace, name]);

  const fetchAvailableDbs = async () => {
    if (!cluster || !activeEnvironmentId) return;
    try {
      setFetchingDbs(true);
      const targetPod = cluster.status?.currentPrimary || name + '-1';
      // List databases excluding templates and system ones if needed, or just list all
      const res = await api.post(`/clusters/${namespace}/${name}/exec/${targetPod}`, { 
        command: "psql -U postgres -t -c \"SELECT datname FROM pg_database WHERE datistemplate = false;\"" 
      });
      if (res.data && typeof res.data === 'string') {
        const dbs = res.data.split('\n').map(d => d.trim()).filter(d => d !== '');
        setAvailableDbs(dbs);
        if (dbs.length > 0 && !dbs.includes(selectedDbForDump)) {
          setSelectedDbForDump(dbs[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch DBs', err);
    } finally {
      setFetchingDbs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'troubleshoot') {
      fetchAvailableDbs();
    }
  }, [activeTab]);

  const runPgDump = async () => {
    const targetPod = cluster?.status?.currentPrimary || name + '-1';
    setPgDumpState('running');
    setPgDumpLogs(`$ pg_dump -U postgres ${selectedDbForDump} > /controller/tmp/backup.sql\nStarting background pg_dump process for DB: ${selectedDbForDump}...`);
    
    try {
      await api.post(`/clusters/${namespace}/${name}/pg_dump/${targetPod}`, { user: 'postgres', db: selectedDbForDump });
      setPgDumpLogs(prev => prev + '\nPolling status...');
    } catch (err) {
      setPgDumpState('idle');
      toast('Failed to trigger pg_dump', 'error');
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete Cluster',
      message: 'Are you sure you want to delete this cluster? This action cannot be undone.',
      type: 'danger'
    });
    if (ok) {
      try {
        await api.delete(`/clusters/${namespace}/${name}`);
        toast('Cluster deletion initiated', 'success');
        navigate('/clusters');
      } catch (err) {
        toast('Failed to delete cluster', 'error');
      }
    }
  };

  const handleScale = async () => {
    try {
      await api.post(`/clusters/${namespace}/${name}/scale`, { instances: scaleInstances });
      toast('Scaling initiated', 'success');
      fetchClusterDetail();
    } catch (err) {
      toast('Scaling failed', 'error');
    }
  };

  const handleFailover = async (targetPod: string) => {
    const isHibernating = cluster.metadata?.annotations?.['cnpg.io/hibernation'] === 'on';
    if (isHibernating) {
      toast('Cannot perform failover while hibernating', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Promote Instance',
      message: `Promote ${targetPod} to Primary? This will trigger a manual failover.`,
      type: 'primary'
    });
    if (ok) {
      try {
        await api.post(`/clusters/${namespace}/${name}/failover`, { targetInstance: targetPod });
        toast('Promotion request sent', 'success');
        fetchClusterDetail();
      } catch (err) {
        toast('Failover failed', 'error');
      }
    }
  };

  const handleForceFailover = async () => {
    const ok = await confirm({
      title: 'Force Failover',
      message: 'WARNING: Force Failover will trigger an immediate, non-graceful primary transition. This may cause temporary service interruption. Proceed?',
      type: 'danger'
    });
    if (ok) {
      try {
        await api.post(`/clusters/${namespace}/${name}/force-failover`);
        toast('Force Failover initiated', 'success');
        fetchClusterDetail();
      } catch (err) {
        toast('Force Failover failed', 'error');
      }
    }
  };

  const handleSuspend = async (suspend: boolean) => {
    const action = suspend ? 'Stop' : 'Start';
    const ok = await confirm({
      title: `${action} Cluster`,
      message: `Are you sure you want to ${action} this database cluster?`,
      type: suspend ? 'danger' : 'primary'
    });
    if (ok) {
      try {
        await api.post(`/clusters/${namespace}/${name}/suspend`, { suspend });
        toast(`Cluster ${action}ed successfully`, 'success');
        fetchClusterDetail();
      } catch (err) {
        toast(`Failed to ${action} cluster`, 'error');
      }
    }
  };

  const handleRestartInstance = async (podName: string) => {
    const ok = await confirm({
        title: 'Restart Instance',
        message: `Are you sure you want to RESTART instance ${podName}? The operator will recreate it automatically.`,
        type: 'danger'
    });
    if (ok) {
      try {
        await api.delete(`/clusters/${namespace}/pods/${podName}`);
        toast('Instance restart initiated!', 'success');
        fetchClusterDetail();
      } catch (err) {
        toast('Failed to restart instance.', 'error');
      }
    }
  };

  const handleFenceInstance = async (podName: string, action: string) => {
    const ok = await confirm({
        title: `${action === 'Stop' ? 'Stop' : 'Start'} Instance`,
        message: `Are you sure you want to ${action} instance ${podName}?`,
        type: action === 'Stop' ? 'danger' : 'primary'
    });
    if (ok) {
      try {
        await api.post(`/clusters/${namespace}/${name}/fence`, { instanceName: podName, fence: action === 'Stop' });
        toast(`Instance ${action} request sent!`, 'success');
        fetchClusterDetail();
      } catch (err) {
        toast(`Failed to ${action} instance.`, 'error');
      }
    }
  };

  const handleUpgrade = async () => {
    const ok = await confirm({
        title: 'Upgrade Cluster',
        message: `Are you sure you want to upgrade this cluster to PostgreSQL ${upgradeVersion}?`,
        type: 'primary'
    });
    if (ok) {
      try {
        await api.post(`/clusters/${namespace}/${name}/upgrade`, { version: upgradeVersion });
        toast('Upgrade initiated!', 'success');
        fetchClusterDetail();
      } catch (err) {
        toast('Upgrade failed.', 'error');
      }
    }
  };

  const handleResizeStorage = async () => {
    if (!newStorageSize) {
      toast('Please enter a storage size', 'error');
      return;
    }
    const ok = await confirm({
        title: 'Resize Storage',
        message: `Are you sure you want to resize storage to ${newStorageSize}? PVCs will be expanded. Zero downtime operation.`,
        type: 'primary'
    });
    if (ok) {
      try {
        await api.post(`/clusters/${namespace}/${name}/resize`, { newSize: newStorageSize });
        toast('Storage resize initiated!', 'success');
        setNewStorageSize('');
        fetchClusterDetail();
      } catch (err) {
        toast('Storage resize failed.', 'error');
      }
    }
  };

  const handleCreateUser = async () => {
    try {
      await api.post(`/clusters/${namespace}/${name}/users`, newUser);
      toast('User created successfully!', 'success');
      setIsAddingUser(false);
      setNewUser({ username: '', password: '' });
      fetchClusterDetail();
    } catch (err) {
      toast('Failed to create user.', 'error');
    }
  };

  const handleUpdateHba = async () => {
    try {
      const rules = hbaText.split('\n').filter(r => r.trim() !== '');
      await api.post(`/clusters/${namespace}/${name}/hba`, { rules });
      toast('HBA rules updated!', 'success');
      setIsEditingHba(false);
      fetchClusterDetail();
    } catch (err) {
      toast('Failed to update HBA rules.', 'error');
    }
  };

  const handleUpdateRoles = async () => {
    try {
      await api.post(`/clusters/${namespace}/${name}/managed-roles`, { roles: managedRoles });
      toast('Managed roles updated!', 'success');
      setIsEditingRoles(false);
      fetchClusterDetail();
    } catch (err) {
      toast('Failed to update managed roles.', 'error');
    }
  };

  const handleAddRole = () => {
    setManagedRoles([...managedRoles, {
      name: '',
      ensure: 'present',
      login: true,
      superuser: false,
      createdb: false,
      createrole: false,
      inherit: true,
      replication: false,
      bypassrls: false,
      connectionLimit: -1
    }]);
  };

  const handleRemoveRole = (index: number) => {
    setManagedRoles(managedRoles.filter((_, i) => i !== index));
  };

  const handleRoleChange = (index: number, field: string, value: any) => {
    const newRoles = [...managedRoles];
    newRoles[index] = { ...newRoles[index], [field]: value };
    if (field === 'name') {
      newRoles[index].passwordSecret = { name: `${name}-${value}-auth` };
    }
    setManagedRoles(newRoles);
  };

  const fetchLogs = async () => {
    if (!selectedPodForLogs) return;
    try {
      setFetchingLogs(true);
      const res = await api.get(`/clusters/${namespace}/${name}/logs/${selectedPodForLogs}`);
      setLogs(res.data);
    } catch (err) {
      setLogs('Failed to fetch logs.');
    } finally {
      setFetchingLogs(false);
    }
  };

  const formatAge = (timestamp: string) => {
    if (!timestamp) return 'Unknown';
    const start = new Date(timestamp).getTime();
    const now = new Date().getTime();
    const diff = Math.floor((now - start) / 1000);
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-gray-500 font-medium">Loading premium cluster dashboard...</p>
      </div>
    );
  }

  if (error || !cluster) {
    return (
      <div className="enterprise-card p-12 text-center space-y-4">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold dark:text-white">Cluster Not Found</h2>
        <p className="text-gray-500">{error || 'The requested cluster does not exist.'}</p>
        <Link to="/clusters" className="inline-block text-blue-600 font-bold hover:underline">Back to Clusters List</Link>
      </div>
    );
  }

  const phase = cluster.status?.phase || 'Unknown';
  const isHibernating = cluster.metadata?.annotations?.['cnpg.io/hibernation'] === 'on';
  const isHealthy = phase === 'Cluster in healthy state' && !isHibernating;
  const pgVersion = cluster.spec?.imageName ? cluster.spec.imageName.split(':')[1] : '16';
  const endpoint = cluster.status?.writeService ? `${cluster.status.writeService}.${cluster.namespace}.svc` : 'N/A';

  const tabs = [
    { id: 'overview', name: 'Overview', icon: Database },
    { id: 'pods', name: 'Instances', icon: Box },
    { id: 'storage', name: 'Storage', icon: HardDrive },
    { id: 'replication', name: 'Replication', icon: Activity },
    { id: 'access', name: 'Access Control', icon: Lock },
    { id: 'tablespaces', name: 'Tablespaces', icon: Layers },
    { id: 'troubleshoot', name: 'Troubleshooting', icon: Terminal },
    { id: 'metrics', name: 'Resources', icon: BarChart3 },
  ].filter(tab => !(isViewer && tab.id === 'troubleshoot'));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <Link to="/clusters" className="flex items-center text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors mb-2 uppercase tracking-widest">
            <ChevronLeft className="w-3 h-3 mr-1" /> Back to Clusters
          </Link>
          <div className="flex items-center space-x-3">
             <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
               <Database className="w-6 h-6 text-white" />
             </div>
             <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white font-outfit">{name}</h1>
             <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center ${isHealthy 
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
                : isHibernating ? 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'}`}>
               <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isHealthy ? 'bg-emerald-500 animate-pulse' : isHibernating ? 'bg-slate-400' : 'bg-amber-500'}`}></span>
               {isHibernating ? 'HIBERNATING' : (typeof phase === 'string' ? phase.toUpperCase() : 'UNKNOWN')}
             </span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
           {!isViewer && (
             <>
               {isHibernating ? (
                 <button onClick={() => handleSuspend(false)} className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20">
                   <Play className="w-4 h-4 mr-2" /> Start DB
                 </button>
               ) : (
                 <button onClick={() => handleSuspend(true)} className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-amber-200 text-amber-600 rounded-xl text-sm font-bold shadow-sm hover:bg-amber-50 transition-all">
                   <Square className="w-4 h-4 mr-2" /> Stop DB
                 </button>
               )}
               <Link to={`/clusters/edit/${namespace}/${name}`} className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20">
                 <Settings className="w-4 h-4 mr-2" /> Edit Config
               </Link>
             </>
           )}
           <button onClick={fetchClusterDetail} className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 transition-all">
             <RefreshCw className="w-4 h-4 mr-2 text-gray-400" /> Refresh
           </button>
           {!isViewer && (
             <button onClick={handleDelete} className="flex items-center px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-bold transition-all">
               <Trash2 className="w-4 h-4 mr-2" /> Delete
             </button>
           )}
        </div>
      </div>

      <div className="flex space-x-1 bg-gray-100/50 dark:bg-gray-900/50 p-1 rounded-xl w-fit">
        {tabs.map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-6 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === tab.id 
              ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <tab.icon className={`w-4 h-4 mr-2 ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'}`} /> 
            {tab.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <DetailCard label="Primary Endpoint" value={endpoint} icon={ExternalLink} />
                  <DetailCard label="PostgreSQL Version" value={pgVersion} icon={ShieldCheck} />
                  <DetailCard label="Uptime" value={formatAge(cluster.creationTimestamp)} icon={Activity} />
               </div>

               <div className="enterprise-card p-6 border-l-4 border-l-blue-600">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold dark:text-white flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-blue-500" /> Replication Topology
                  </h3>
                  {!isViewer && (
                    <button onClick={handleForceFailover} className="px-3 py-1 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-bold hover:bg-red-100 transition-all">
                      <Zap className="w-3.5 h-3.5 mr-1 inline" /> Force Failover
                    </button>
                  )}
                </div>
                  <h3 className="text-lg font-bold dark:text-white mb-6">Cluster Management</h3>
                  {!isViewer && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                          <div className="flex items-center mb-4">
                             <Scale className="w-5 h-5 text-blue-600 mr-2" />
                             <h4 className="text-sm font-bold dark:text-white">Vertical Scaling</h4>
                          </div>
                          <p className="text-xs text-gray-500 mb-4">Adjust the number of PostgreSQL instances. Zero downtime failover enabled.</p>
                          <div className="flex space-x-2">
                            <input type="number" value={scaleInstances} onChange={e => setScaleInstances(parseInt(e.target.value))} className="w-24 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                            <button onClick={handleScale} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-bold transition-all shadow-lg shadow-blue-500/20">Apply Scale</button>
                          </div>
                       </div>
                       <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                          <div className="flex items-center mb-4">
                             <Zap className="w-5 h-5 text-amber-600 mr-2" />
                             <h4 className="text-sm font-bold dark:text-white">Engine Upgrade</h4>
                          </div>
                          <p className="text-xs text-gray-500 mb-4">Switch to a newer PostgreSQL minor or major version.</p>
                          <div className="flex space-x-2">
                            <select value={upgradeVersion} onChange={e => setUpgradeVersion(e.target.value)} className="flex-1 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500">
                              <option value="14">PostgreSQL 14</option>
                              <option value="15">PostgreSQL 15</option>
                              <option value="16">PostgreSQL 16</option>
                              <option value="17">PostgreSQL 17</option>
                            </select>
                            <button onClick={handleUpgrade} className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 text-sm font-bold transition-all shadow-lg shadow-amber-500/20">Upgrade</button>
                          </div>
                       </div>
                    </div>
                  )}
               </div>
            </div>
          )}

          {activeTab === 'pods' && (
            <div className="enterprise-card overflow-hidden">
               <table className="w-full compact-table">
                  <thead>
                    <tr>
                      <th className="text-left">Pod Name</th>
                      <th className="text-left">Role</th>
                      <th className="text-left">Status</th>
                      <th className="text-right">Actionamespace</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {(cluster.status?.instancesDetails || cluster.status?.instanceNames || []).map((pod: any) => {
                      const podName = typeof pod === 'string' ? pod : pod.name;
                      const podStatus = typeof pod === 'string' ? 'RUNNING' : pod.status;
                      const isReady = typeof pod === 'string' ? true : pod.ready;
                      const isCurrentPrimary = podName === cluster.status?.currentPrimary;
                      const isTargetPrimary = podName === cluster.status?.targetPrimary;
                      const isPrimary = isCurrentPrimary || isTargetPrimary;
                      const isFenced = cluster.spec?.fencedInstances?.includes(podName);
                      
                      return (
                        <tr key={podName} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                          <td className="font-mono text-xs font-bold text-gray-900 dark:text-white">
                            <div className="flex items-center">
                              <Box className={`w-3 h-3 mr-2 ${isReady ? 'text-emerald-500' : 'text-amber-500'}`} />
                              {podName}
                            </div>
                          </td>
                          <td className="text-xs">
                            {isCurrentPrimary ? (
                              <span className="flex items-center text-blue-600 font-bold"><Zap className="w-3 h-3 mr-1" /> PRIMARY</span>
                            ) : isTargetPrimary ? (
                              <span className="flex items-center text-amber-600 font-bold animate-pulse"><RefreshCw className="w-3 h-3 mr-1" /> PROMOTING...</span>
                            ) : (
                              <span className="text-gray-500">STANDBY</span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center space-x-2">
                               <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${podStatus === 'Running' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                 {podStatus.toUpperCase()}
                               </span>
                               {isFenced && (
                                 <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                   STOPPED (FENCED)
                                 </span>
                               )}
                            </div>
                          </td>
                          <td className="text-right">
                             {!isViewer && (
                               <div className="flex items-center justify-end space-x-2">
                                  {!isPrimary && (
                                    <button onClick={() => handleFailover(podName)} className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-all" title="Graceful Switchover">
                                      <RefreshCw className="w-3 h-3 mr-1" /> Switchover
                                    </button>
                                  )}
                                  {isPrimary && (
                                    <button onClick={() => handleRestartInstance(podName)} className="inline-flex items-center px-2 py-1 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10px] font-bold hover:bg-red-100 transition-all" title="Force Failover (Pod Delete)">
                                      <Zap className="w-3 h-3 mr-1" /> Force Failover
                                    </button>
                                  )}
                                  <button onClick={() => handleFenceInstance(podName, isFenced ? 'Start' : 'Stop')} className={`inline-flex items-center px-2 py-1 border rounded-lg text-[10px] font-bold transition-all ${isFenced ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'}`} title={isFenced ? 'Start Instance' : 'Stop Instance'}>
                                     {isFenced ? <Play className="w-3 h-3 mr-1" /> : <Square className="w-3 h-3 mr-1" />}
                                     {isFenced ? 'Start' : 'Stop'}
                                  </button>
                               </div>
                             )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <DetailCard label="Provisioned Size" value={cluster.spec?.storage?.size || cluster.spec?.storage?.pvcTemplate?.spec?.resources?.requests?.storage || 'N/A'} icon={HardDrive} />
                   <DetailCard label="Storage Class" value={cluster.spec?.storage?.storageClass || cluster.spec?.storage?.pvcTemplate?.spec?.storageClassName || 'default'} icon={Settings} />
               </div>
               {!isViewer && (
                 <div className="enterprise-card p-6">
                    <h3 className="text-lg font-bold dark:text-white mb-4 flex items-center">
                      <HardDrive className="w-5 h-5 mr-2 text-blue-500" /> Resize Storage
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">Expand PVC for all instances. This is a zero-downtime operation.</p>
                    <div className="flex space-x-2">
                      <input 
                        type="text" 
                        placeholder="e.g., 20Gi, 50Gi, 100Gi" 
                        value={newStorageSize} 
                        onChange={e => setNewStorageSize(e.target.value)} 
                        className="flex-1 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                      />
                      <button onClick={handleResizeStorage} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-bold transition-all shadow-lg shadow-blue-500/20">
                        <HardDrive className="w-4 h-4 mr-1 inline" /> Resize
                      </button>
                    </div>
                 </div>
               )}
               <div className="enterprise-card p-6">
                  <h3 className="text-sm font-bold dark:text-white mb-4">Persistent Volume Claims</h3>
                  <div className="space-y-3">
                     {(cluster.status?.instanceNames || []).map((pod: string) => (
                       <div key={pod} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                          <div className="flex items-center">
                             <HardDrive className="w-4 h-4 text-blue-500 mr-3" />
                             <div>
                                <p className="text-xs font-bold dark:text-white">{pod}-storage</p>
                                <p className="text-[10px] text-gray-500">Mount: /var/lib/postgresql/data</p>
                             </div>
                          </div>
                          <span className="text-xs font-mono font-bold text-emerald-600 uppercase">Bound</span>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'replication' && (
            <div className="space-y-6">
               <div className="enterprise-card p-8">
                  <h3 className="text-xl font-bold dark:text-white mb-8 flex items-center">
                    <Activity className="w-6 h-6 mr-3 text-blue-500" /> Infrastructure Topology
                  </h3>
                  
                  <div className="flex flex-col items-center space-y-12 relative">
                     {/* Client/User Entry Point */}
                     <div className="flex flex-col items-center">
                        <div className="px-6 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-bold text-slate-500 mb-4 border border-slate-200 dark:border-slate-700">
                          EXTERNAL CLIENTS
                        </div>
                        <div className="w-1 h-8 bg-gradient-to-b from-slate-200 to-blue-200 dark:from-slate-700 dark:to-blue-900"></div>
                     </div>

                     {/* Connection Pooler Layer */}
                     {pooler && pooler.enabled ? (
                        <div className="flex flex-col items-center group">
                           <div className="w-72 p-5 bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl shadow-xl shadow-blue-500/20 text-center relative z-20 border border-white/10">
                              <Layers className="w-6 h-6 mx-auto mb-2 text-blue-200" />
                              <h4 className="text-sm font-bold tracking-tight">PgBouncer Pooler</h4>
                              <div className="mt-2 flex items-center justify-center space-x-3 text-[10px] font-medium text-blue-100">
                                 <span className="px-2 py-0.5 bg-white/10 rounded-full">{pooler.poolMode?.toUpperCase()}</span>
                                 <span className="px-2 py-0.5 bg-white/10 rounded-full">{pooler.instances} INSTANCES</span>
                              </div>
                           </div>
                           <div className="w-1 h-12 bg-blue-200 dark:bg-blue-900"></div>
                        </div>
                     ) : (
                        <div className="flex flex-col items-center">
                           <div className="px-4 py-2 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-[10px] font-bold text-gray-400">
                             DIRECT CONNECTION
                           </div>
                           <div className="w-1 h-12 bg-gray-200 dark:bg-gray-800"></div>
                        </div>
                     )}

                     {/* Primary Node */}
                     <div className="flex flex-col items-center group">
                        <div className="w-80 p-6 bg-white dark:bg-slate-900 border-2 border-blue-600 rounded-3xl shadow-2xl relative z-10 text-center ring-8 ring-blue-50 dark:ring-blue-900/10">
                           <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full shadow-lg">PRIMARY (RW)</div>
                           <Zap className="w-8 h-8 mx-auto mb-3 text-blue-600" />
                           <p className="text-sm font-black dark:text-white font-mono tracking-tighter">{cluster.status?.currentPrimary || cluster.status?.targetPrimary}</p>
                           <p className="text-[10px] text-emerald-500 font-bold mt-2 flex items-center justify-center uppercase">
                             <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span> Healthy State
                           </p>
                        </div>
                        <div className="h-16 w-full flex items-center justify-center relative">
                           <div className="absolute top-0 w-px h-full bg-blue-200 dark:bg-blue-900"></div>
                           <div className="w-[80%] h-px bg-blue-200 dark:bg-blue-900"></div>
                        </div>
                     </div>
                     
                     {/* Standby Nodes */}
                     <div className="flex flex-wrap justify-center gap-10">
                        {(cluster.status?.instanceNames || []).filter((p: string) => p !== cluster.status?.targetPrimary && p !== cluster.status?.currentPrimary).map((pod: string) => (
                          <div key={pod} className="flex flex-col items-center group">
                            <div className="absolute -top-8 w-px h-8 bg-blue-200 dark:bg-blue-900"></div>
                            <div className="w-56 p-5 bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-2xl text-center relative shadow-sm hover:shadow-lg transition-all hover:-translate-y-1">
                               <Activity className="w-5 h-5 mx-auto mb-2 text-emerald-500" />
                               <p className="text-xs font-bold dark:text-white font-mono">{pod}</p>
                               <p className="text-[10px] text-gray-500 mt-2 font-medium bg-gray-50 dark:bg-gray-800/50 py-1 rounded-lg">Standby (RO) - Synced</p>
                            </div>
                          </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'troubleshoot' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Emergency Tools */}
                  <div className="lg:col-span-1 space-y-4">
                     <div className="enterprise-card p-6 bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 flex flex-col h-full">
                        <h3 className="text-sm font-bold text-red-800 dark:text-red-400 mb-4 flex items-center">
                          <Zap className="w-4 h-4 mr-2" /> Emergency Utilities
                        </h3>
                        
                        {!isViewer && (
                          <>
                            {pgDumpState === 'idle' && (
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-[10px] font-bold text-red-800 dark:text-red-400 mb-1.5 uppercase opacity-70">Target Database</label>
                                  <div className="flex space-x-2">
                                    <select 
                                      value={selectedDbForDump} 
                                      onChange={e => setSelectedDbForDump(e.target.value)}
                                      className="flex-1 bg-white/50 dark:bg-black/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-red-400 dark:text-white"
                                    >
                                      {availableDbs.length > 0 ? (
                                        availableDbs.map(db => <option key={db} value={db}>{db}</option>)
                                      ) : (
                                        <option value="app">app</option>
                                      )}
                                    </select>
                                    <button onClick={fetchAvailableDbs} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-600 transition-colors">
                                      <RefreshCw className={`w-4 h-4 ${fetchingDbs ? 'animate-spin' : ''}`} />
                                    </button>
                                  </div>
                                </div>
                                <button onClick={runPgDump} className="w-full py-3 bg-red-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-500/20 hover:bg-red-700 transition-all">
                                  Run Emergency Backup (pg_dump)
                                </button>
                              </div>
                            )}
                            {pgDumpState === 'running' && (
                              <div className="w-full py-3 bg-red-500/50 text-white rounded-xl text-xs font-bold text-center mb-3 flex items-center justify-center">
                                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Running pg_dump...
                              </div>
                            )}
                            {pgDumpState === 'completed' && (
                              <button onClick={() => {
                                const targetPod = cluster.status?.currentPrimary || name + '-1';
                                toast('Downloading backup.sql...', 'success');
                                api.get(`/clusters/${namespace}/${name}/pg_dump/${targetPod}`, {
                                  responseType: 'blob'
                                }).then(res => {
                                  const url = window.URL.createObjectURL(new Blob([res.data]));
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.setAttribute('download', 'backup.sql');
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  setPgDumpState('idle');
                                  // Cleanup temp files inside pod
                                  api.post(`/clusters/${namespace}/${name}/exec/${targetPod}`, { command: "rm -f /controller/tmp/backup.sql /controller/tmp/backup_status.txt" });
                                }).catch(err => {
                                  toast('Download failed', 'error');
                                });
                              }} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all mb-3 flex items-center justify-center">
                                <Download className="w-4 h-4 mr-2" /> Download backup.sql
                              </button>
                            )}
                          </>
                        )}
                        
                        {(pgDumpState === 'running' || pgDumpState === 'completed') && (
                          <div className="mt-2 bg-black rounded-lg p-3 text-[10px] font-mono text-emerald-400 whitespace-pre-wrap h-32 overflow-y-auto custom-scrollbar">
                            {pgDumpLogs}
                          </div>
                        )}
                        <div className="mt-auto pt-3">
                           <p className="text-[10px] text-red-700 dark:text-red-500 italic text-center leading-relaxed">Bypasses backup policy to extract raw data immediately.<br/><br/><strong className="text-red-800 dark:text-red-300">Info:</strong> pg_dump process starts inside the Primary pod. Please do not close the page during the process.</p>
                        </div>
                     </div>
                  </div>

                  {/* Advanced Log Analyzer & Shell */}
                  <div className="lg:col-span-2 space-y-4">
                     <div className="bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[500px] shadow-2xl">
                        <div className="p-3 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between">
                           <div className="flex items-center space-x-3">
                              <button onClick={() => setTroubleshootView('logs')} className={`text-[10px] font-bold px-4 py-1.5 rounded transition-all ${troubleshootView === 'logs' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>Logs</button>
                              <button onClick={() => setTroubleshootView('shell')} className={`text-[10px] font-bold px-4 py-1.5 rounded transition-all flex items-center space-x-2 ${troubleshootView === 'shell' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                                 <Terminal className="w-3 h-3" /> <span>Shell</span>
                              </button>
                              
                              {troubleshootView === 'logs' && (
                                <>
                                  <div className="h-4 w-px bg-slate-700 mx-1"></div>
                                  <select 
                                     value={selectedPodForLogs} 
                                     onChange={e => setSelectedPodForLogs(e.target.value)}
                                     className="bg-slate-800 border border-slate-700 focus:border-blue-500 text-[10px] text-white rounded px-2 py-1 outline-none font-mono"
                                  >
                                     {(cluster.status?.instanceNames || []).map((p: string) => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                  <button onClick={fetchLogs} disabled={fetchingLogs} className="flex items-center px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition-all">
                                     {fetchingLogs ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                  </button>
                                </>
                              )}
                           </div>
                           <div className="flex space-x-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                              <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                              <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                           </div>
                        </div>
                        {troubleshootView === 'logs' ? (
                          <div className="flex-1 p-4 font-mono text-[11px] text-slate-400 overflow-auto custom-scrollbar leading-relaxed">
                             <pre className="whitespace-pre-wrap">
                                {logs.split('\n').map((line, i) => (
                                   <div key={i} className="hover:bg-slate-800/50 px-2 rounded -mx-2 transition-colors">
                                      <span className="text-slate-600 mr-4 select-none">{i + 1}</span>
                                      <span className={line.includes('ERROR') || line.includes('FATAL') ? 'text-red-400' : line.includes('WARN') ? 'text-amber-400' : ''}>{line}</span>
                                   </div>
                                ))}
                             </pre>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col bg-[#020617] relative">
                             <div ref={terminalRef} className="flex-1" style={{ padding: '8px' }} />
                             {!terminalConnected && (
                               <div className="absolute inset-0 flex items-center justify-center bg-[#020617]/90 z-10">
                                 <div className="text-center">
                                   <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto mb-2" />
                                   <p className="text-emerald-400 text-xs font-mono">Connecting to pod...</p>
                                 </div>
                               </div>
                             )}
                          </div>
                        )}
                     </div>
                  </div>
               </div>
               
               {/* Connectivity Box */}
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1">
                     <div className="enterprise-card p-6">
                        <h3 className="text-sm font-bold dark:text-white mb-4">Connectivity Check</h3>
                        <div className="space-y-3">
                           <div className="flex justify-between items-center text-[10px]">
                              <span className="text-gray-500">Read-Write Service</span>
                              <span className="text-emerald-500 font-bold">REACHABLE</span>
                           </div>
                           <div className="flex justify-between items-center text-[10px]">
                              <span className="text-gray-500">Read-Only Service</span>
                              <span className="text-emerald-500 font-bold">REACHABLE</span>
                           </div>
                           <div className="flex justify-between items-center text-[10px]">
                              <span className="text-gray-500">Primary Instance Ping</span>
                              <span className="text-emerald-500 font-bold">0.4ms</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'access' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Managed Roles Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold dark:text-white flex items-center">
                    <ShieldCheck className="w-5 h-5 mr-2 text-indigo-500" /> Managed Declarative Roles
                  </h3>
                  <div className="flex items-center space-x-2">
                    {!isViewer && (
                      isEditingRoles ? (
                        <>
                          <button onClick={handleAddRole} className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700">+ ADD ROLE</button>
                          <button onClick={handleUpdateRoles} className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 flex items-center"><Settings className="w-3 h-3 mr-1" /> SAVE</button>
                          <button onClick={() => { setIsEditingRoles(false); fetchClusterDetail(); }} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] font-bold rounded-lg">CANCEL</button>
                        </>
                      ) : (
                        <button onClick={() => setIsEditingRoles(true)} className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700">EDIT ROLES</button>
                      )
                    )}
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest ml-2">CNPG Managed</p>
                  </div>
                </div>
                <div className="enterprise-card overflow-hidden">
                  <table className="w-full compact-table">
                    <thead>
                      <tr>
                        <th className="text-left">Role Name</th>
                        <th className="text-left">Ensure</th>
                        <th className="text-left text-center">Login</th>
                        <th className="text-left text-center">Super</th>
                        <th className="text-left text-center">DB</th>
                        <th className="text-left text-center">Role</th>
                        <th className="text-left text-center">Inh</th>
                        <th className="text-left text-center">Repl</th>
                        <th className="text-left text-center">RLS</th>
                        <th className="text-left">Limit</th>
                        <th className="text-left">InRoles</th>
                        {isEditingRoles && <th className="text-left">Password</th>}
                        {isEditingRoles && <th className="w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {(isEditingRoles ? managedRoles : (cluster.spec?.managed?.roles || [])).map((role: any, idx: number) => (
                        <tr key={isEditingRoles ? idx : role.name} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50">
                          <td>
                            {isEditingRoles ? (
                              <input type="text" className="w-full bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none text-sm font-bold dark:text-white"
                                value={role.name} onChange={e => handleRoleChange(idx, 'name', e.target.value)} />
                            ) : (
                              <span className="text-sm font-bold dark:text-white">{role.name}</span>
                            )}
                          </td>
                          <td>
                            {isEditingRoles ? (
                              <select className="bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none text-[10px] font-bold dark:text-white uppercase"
                                value={role.ensure || 'present'} onChange={e => handleRoleChange(idx, 'ensure', e.target.value)}>
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                              </select>
                            ) : (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${role.ensure === 'absent' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {role.ensure?.toUpperCase() || 'PRESENT'}
                              </span>
                            )}
                          </td>
                          <td className="text-center">
                            {isEditingRoles ? (
                              <input type="checkbox" checked={role.login ?? true} onChange={e => handleRoleChange(idx, 'login', e.target.checked)} />
                            ) : (
                              role.login ?? true ? <CheckCircle className="w-3 h-3 text-emerald-500 mx-auto" /> : <Square className="w-3 h-3 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="text-center">
                            {isEditingRoles ? (
                              <input type="checkbox" checked={role.superuser ?? false} onChange={e => handleRoleChange(idx, 'superuser', e.target.checked)} />
                            ) : (
                              role.superuser ? <CheckCircle className="w-3 h-3 text-emerald-500 mx-auto" /> : <Square className="w-3 h-3 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="text-center">
                            {isEditingRoles ? (
                              <input type="checkbox" checked={role.createdb ?? false} onChange={e => handleRoleChange(idx, 'createdb', e.target.checked)} />
                            ) : (
                              role.createdb ? <CheckCircle className="w-3 h-3 text-emerald-500 mx-auto" /> : <Square className="w-3 h-3 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="text-center">
                            {isEditingRoles ? (
                              <input type="checkbox" checked={role.createrole ?? false} onChange={e => handleRoleChange(idx, 'createrole', e.target.checked)} />
                            ) : (
                              role.createrole ? <CheckCircle className="w-3 h-3 text-emerald-500 mx-auto" /> : <Square className="w-3 h-3 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="text-center">
                            {isEditingRoles ? (
                              <input type="checkbox" checked={role.inherit ?? true} onChange={e => handleRoleChange(idx, 'inherit', e.target.checked)} />
                            ) : (
                              role.inherit ?? true ? <CheckCircle className="w-3 h-3 text-emerald-500 mx-auto" /> : <Square className="w-3 h-3 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="text-center">
                            {isEditingRoles ? (
                              <input type="checkbox" checked={role.replication ?? false} onChange={e => handleRoleChange(idx, 'replication', e.target.checked)} />
                            ) : (
                              role.replication ? <CheckCircle className="w-3 h-3 text-orange-500 mx-auto" /> : <Square className="w-3 h-3 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="text-center">
                            {isEditingRoles ? (
                              <input type="checkbox" checked={role.bypassrls ?? false} onChange={e => handleRoleChange(idx, 'bypassrls', e.target.checked)} />
                            ) : (
                              role.bypassrls ? <CheckCircle className="w-3 h-3 text-purple-500 mx-auto" /> : <Square className="w-3 h-3 text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td>
                            {isEditingRoles ? (
                              <input type="number" className="w-16 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none text-[10px] font-mono dark:text-white"
                                value={role.connectionLimit ?? -1} onChange={e => handleRoleChange(idx, 'connectionLimit', parseInt(e.target.value))} />
                            ) : (
                              <span className="text-[10px] font-mono">{role.connectionLimit ?? '-1'}</span>
                            )}
                          </td>
                          <td>
                            {isEditingRoles ? (
                              <input type="text" className="w-24 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none text-[10px] font-mono dark:text-white"
                                placeholder="role1, role2" value={role.inRoles ? role.inRoles.join(', ') : ''} 
                                onChange={e => handleRoleChange(idx, 'inRoles', e.target.value.split(',').map((s: string) => s.trim()).filter((s: string) => s !== ''))} />
                            ) : (
                              <span className="text-[10px] font-mono text-blue-500">{role.inRoles ? role.inRoles.join(', ') : '-'}</span>
                            )}
                          </td>
                          {isEditingRoles && (
                            <td>
                              <input type="password" placeholder="New Pwd" 
                                className="w-20 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none text-[10px] font-mono dark:text-white"
                                value={role.password || ''} onChange={e => handleRoleChange(idx, 'password', e.target.value)} />
                            </td>
                          )}
                          {isEditingRoles && (
                            <td>
                              <button onClick={() => handleRemoveRole(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {(isEditingRoles ? managedRoles : (cluster.spec?.managed?.roles || [])).length === 0 && (
                        <tr><td colSpan={isEditingRoles ? 11 : 10} className="py-8 text-center text-xs text-gray-400 italic">No managed roles defined.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* HBA Rules Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold dark:text-white flex items-center">
                    <Lock className="w-5 h-5 mr-2 text-blue-500" /> Connection Security (HBA)
                  </h3>
                  {!isEditingHba ? (
                    <button onClick={() => setIsEditingHba(true)} className="px-4 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold">Edit HBA</button>
                  ) : (
                    <div className="flex space-x-2">
                      <button onClick={() => setIsEditingHba(false)} className="px-3 py-1 text-gray-500 text-[10px] font-bold">Cancel</button>
                      <button onClick={handleUpdateHba} className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold">Save</button>
                    </div>
                  )}
                </div>
                <div className="enterprise-card p-0 overflow-hidden">
                  {isEditingHba ? (
                    <textarea value={hbaText} onChange={e => setHbaText(e.target.value)} rows={8} className="w-full p-4 font-mono text-[10px] bg-gray-900 text-blue-300 outline-none" />
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
                      <pre className="text-[10px] font-mono text-gray-700 dark:text-gray-300">{hbaRules.length > 0 ? hbaRules.join('\n') : 'No custom rules.'}</pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Legacy Users Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                   <h3 className="text-lg font-bold dark:text-white">External Secrets Users</h3>
                </div>
                <div className="enterprise-card overflow-hidden opacity-80">
                  <table className="w-full compact-table">
                     <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {(users || [])
                          .filter((user: any) => user.secretName === `${name}-superuser` || user.secretName === `${name}-user-auth`)
                          .map((user: any) => (
                          <tr key={user.name}>
                            <td className="text-xs font-bold dark:text-white">{user.username}</td>
                            <td className="text-[10px] font-mono text-blue-600">{user.secretName}</td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tablespaces' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold dark:text-white flex items-center">
                    <Layers className="w-5 h-5 mr-2 text-amber-500" /> Custom Tablespaces
                  </h3>
               </div>
               <div className="enterprise-card overflow-hidden">
                  <table className="w-full compact-table">
                    <thead>
                      <tr>
                        <th className="text-left">Name</th>
                        <th className="text-left">Owner</th>
                        <th className="text-left">Size</th>
                        <th className="text-left">Type</th>
                        <th className="text-left">Storage Class</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {(cluster.spec?.tablespaces || []).map((ts: any) => (
                        <tr key={ts.name} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50">
                          <td className="text-sm font-bold dark:text-white">{ts.name}</td>
                          <td className="text-xs font-mono">{ts.owner?.name || 'postgres'}</td>
                          <td className="text-xs font-bold text-blue-600">{ts.storage?.size}</td>
                          <td>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ts.temporary ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                              {ts.temporary ? 'TEMPORARY' : 'PERMANENT'}
                            </span>
                          </td>
                          <td className="text-[10px] text-gray-500">{ts.storage?.storageClassName || 'Inherited'}</td>
                        </tr>
                      ))}
                      {(cluster.spec?.tablespaces || []).length === 0 && (
                        <tr><td colSpan={5} className="py-12 text-center text-xs text-gray-400 italic">No custom tablespaces defined in cluster spec.</td></tr>
                      )}
                    </tbody>
                  </table>
               </div>
               <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-xl">
                  <p className="text-[10px] text-amber-700 font-bold uppercase mb-1">Tablespace Information</p>
                  <p className="text-xs text-amber-600">Custom tablespaces are provisioned as separate PVCs and mounted into the PostgreSQL instances. Changes may require pod restarts.</p>
               </div>
            </div>
          )}

          {activeTab === 'metrics' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="enterprise-card p-6">
                   <h3 className="text-sm font-bold dark:text-white mb-6">Resource Allocation</h3>
                   <div className="space-y-6">
                      <MetricBar label="CPU Limit" value="1.0 Core" percent={50} color="blue" />
                      <MetricBar label="Memory Limit" value="2.0 GiB" percent={65} color="indigo" />
                      <MetricBar label="Current Connectionamespace" value="12 / 100" percent={12} color="emerald" />
                   </div>
                </div>
                <div className="enterprise-card p-6">
                   <h3 className="text-sm font-bold dark:text-white mb-4">Cluster Health Overview</h3>
                   <div className="space-y-3">
                      <ConfigItem label="Database State" value={phase} />
                      <ConfigItem label="Instances Healthy" value={`${cluster.status?.instances || 0} / ${cluster.spec?.instances || 0}`} />
                      <ConfigItem label="Ready Instances" value={cluster.status?.readyInstances?.toString() || '0'} />
                      <ConfigItem label="Timeline ID" value={cluster.status?.timeline?.toString() || '1'} />
                   </div>
                </div>
             </div>
          )}
        </div>

        <div className="space-y-6">
           <div className="enterprise-card p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none shadow-xl shadow-blue-500/20">
              <h3 className="text-sm font-bold mb-4 opacity-90">Storage Status</h3>
              <div className="space-y-4">
                 <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                       <span>Allocation</span>
                       <span>{cluster.spec?.storage?.size || 'N/A'}</span>
                    </div>
                    <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                       <div className="h-full bg-white w-[100%] rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
                    </div>
                 </div>
                 <p className="text-[10px] opacity-70">PVC: {name}-storage<br/>Class: {cluster.spec?.storage?.storageClass || 'default'}</p>
              </div>
           </div>

           <div className="enterprise-card p-6">
              <h3 className="text-sm font-bold dark:text-white mb-4">Configuration Preview</h3>
              <div className="space-y-3">
                 <ConfigItem label="Sync Replication" value={cluster.spec?.postgresql?.syncReplicaElectionConamespacetraint?.enabled ? 'Enabled' : 'Disabled'} />
                 <ConfigItem label="Failover" value={cluster.spec?.failoverDelay === 0 ? 'Inamespacetant' : 'Automated'} />
                 <ConfigItem label="Backup Retention" value={cluster.spec?.backup?.retentionPolicy || 'None'} />
                 <ConfigItem label="Monitoring" value={cluster.spec?.monitoring?.enablePodMonitor ? 'Prometheus' : 'Standard'} />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function MetricBar({ label, value, percent, color }: { label: string, value: string, percent: number, color: string }) {
  const colors: any = {
    blue: 'bg-blue-600 shadow-blue-500/40',
    indigo: 'bg-indigo-600 shadow-indigo-500/40',
    emerald: 'bg-emerald-600 shadow-emerald-500/40'
  };
  return (
    <div>
      <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase mb-2">
        <span>{label}</span>
        <span className="text-gray-900 dark:text-white">{value}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]} rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]`} style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  );
}

interface DetailCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
}

function DetailCard({ label, value, icon: Icon }: DetailCardProps) {
  return (
    <div className="enterprise-card p-5">
      <div className="flex items-center text-gray-500 dark:text-gray-400 mb-2">
        <Icon className="w-4 h-4 mr-2" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
        {typeof value === 'string' ? value : JSON.stringify(value)}
      </p>
    </div>
  );
}

interface ConfigItemProps {
  label: string;
  value: string;
}

function ConfigItem({ label, value }: ConfigItemProps) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-bold dark:text-white">
        {typeof value === 'string' || typeof value === 'number' ? value : JSON.stringify(value)}
      </span>
    </div>
  );
}
