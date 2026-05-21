import React, { useState, useEffect } from 'react';
import { Server, Database, HardDrive, Bell, Activity, Shield, Users, BarChart3, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import api from '../api/axios';
import { useTenant } from '../context/TenantContext';

export default function Dashboard() {
  const { activeEnvironmentId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalClusters: 0,
    totalReplicas: 0,
    totalStorage: '0 GB',
    isHealthy: true,
    distribution: {} as Record<string, number>,
    recentEvents: [] as any[]
  });

  const fetchDashboardData = async () => {
    if (!activeEnvironmentId) return;
    try {
      setLoading(true);
      const res = await api.get('/dashboard/metrics');
      setMetrics(res.data);
    } catch (err) {
      console.error("Dashboard fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [activeEnvironmentId]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white font-outfit">Platform Overview</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time health status across all managed clusters.</p>
        </div>
        <div className="flex space-x-2">
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Active Clusters" value={metrics.totalClusters.toString()} trend="+0" icon={Server} color="blue" />
        <StatCard title="Total Replicas" value={metrics.totalReplicas.toString()} trend="Stable" icon={Database} color="indigo" />
        <StatCard title="Storage Used" value={metrics.totalStorage} trend="Real-time" icon={HardDrive} color="emerald" />
        <StatCard title="System Events" value={metrics.recentEvents.length.toString()} trend="Live" icon={Bell} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="enterprise-card p-6 min-h-[400px]">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-lg font-bold dark:text-white">Cluster Distribution</h3>
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">By Namespace</span>
             </div>
             
             {Object.keys(metrics.distribution || {}).length > 0 ? (
               <div className="space-y-6 mt-8">
                 {Object.entries(metrics.distribution || {}).map(([ns, count]) => (
                   <div key={ns} className="space-y-2">
                     <div className="flex justify-between text-sm font-bold dark:text-white">
                        <span>{ns}</span>
                        <span className="text-blue-600">{count} Clusters</span>
                     </div>
                     <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full shadow-lg shadow-blue-500/20" 
                          style={{ width: `${(count / metrics.totalClusters) * 100}%` }}
                        ></div>
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-900/50">
                  <BarChart3 className="w-12 h-12 text-gray-300 mb-4" />
                  <p className="text-gray-400 text-sm">No distribution data available yet.</p>
               </div>
             )}
          </div>
        </div>
        
        <div className="space-y-6">
           <div className="enterprise-card p-6 min-h-[400px]">
              <h3 className="text-lg font-bold dark:text-white mb-6">Recent Kubernetes Events</h3>
              <div className="space-y-5">
                {(metrics.recentEvents || []).length > 0 ? (metrics.recentEvents || []).map((ev, i) => (
                  <div key={i} className="flex items-start space-x-3 group">
                    <div className={`p-2 rounded-lg transition-colors ${
                      ev.type === 'Warning' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
                    }`}>
                      {ev.type === 'Warning' ? (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      ) : (
                        <Info className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold dark:text-white truncate group-hover:text-blue-600 transition-colors">{ev.object}</p>
                      <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">
                        {typeof ev.message === 'string' ? ev.message : JSON.stringify(ev.message)}
                      </p>
                      <p className="text-[9px] text-gray-400 mt-1 uppercase font-bold">{new Date(ev.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-12 opacity-40">
                    <CheckCircle className="w-10 h-10 mb-2" />
                    <p className="text-xs font-bold">No recent events</p>
                  </div>
                )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, icon: Icon, color }: any) {
  const colorMap: any = {
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  };
  return (
    <div className="enterprise-card p-6 group hover:border-blue-500/50 transition-all">
      <div className="flex justify-between items-start">
        <div className={`p-3 rounded-2xl ${colorMap[color]} transition-transform group-hover:scale-110 shadow-sm`}>
          <Icon className="w-6 h-6" />
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400`}>
          {trend}
        </span>
      </div>
      <div className="mt-4">
        <h4 className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">{title}</h4>
        <p className="text-3xl font-bold dark:text-white mt-1 font-outfit tracking-tight">{value}</p>
      </div>
    </div>
  );
}
