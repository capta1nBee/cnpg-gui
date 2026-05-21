import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { ShieldCheck, Cpu, Database, Lock, User, RefreshCw, BarChart3, Globe, type LucideIcon } from 'lucide-react';
import logo from '../assets/logo.svg';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authType, setAuthType] = useState('local');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { login, isAuthenticated } = useAuth();
  const { toast } = useUI();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/tenants', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { username, password, authType });
      login(response.data.token, { username: response.data.username || username, role: response.data.role || 'USER' });
      toast('Login successful!', 'success');
      navigate('/tenants');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Authentication failed. Please check your credentials.';
      const code = err.response?.data?.code || '';

      if (code === 'AUTH_005') {
        if (msg.includes('LDAP') && authType === 'local') setAuthType('ldap');
        else if (msg.includes('Local') && authType === 'ldap') setAuthType('local');
      }

      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#020617] overflow-hidden">
      {/* Left Side: Branding & Features */}
      <div className="hidden lg:flex w-7/12 bg-[#0f172a] relative p-16 flex-col justify-between overflow-hidden">
        {/* Abstract Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute top-1/2 -right-24 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>
          <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-slate-800/30 rounded-full blur-[150px]"></div>
          
          {/* Subtle Grid Pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center space-x-4 mb-16">
            <div className="p-2.5 bg-white shadow-2xl shadow-white/10 rounded-xl">
              <img src={logo} alt="Logo" className="w-9 h-9" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight font-outfit">Poyraz-CNPG</span>
          </div>
          
          <div className="max-w-xl">
            <h1 className="text-6xl font-bold text-white leading-[1.1] font-outfit mb-8 tracking-tight">
              Enterprise <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">PostgreSQL</span> Orchestration.
            </h1>
            <p className="text-slate-400 text-xl leading-relaxed font-light">
              Streamline your database operations with automated provisioning, high-availability management, and unified monitoring for CloudNativePG.
            </p>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-12 max-w-2xl">
           <Feature 
             icon={ShieldCheck} 
             title="High Availability" 
             desc="Synchronous replication and automated failover management for zero-downtime operations." 
           />
           <Feature 
             icon={Database} 
             title="Storage Integration" 
             desc="Native S3/MinIO integration for automated backups and point-in-time recovery (PITR)." 
           />
           <Feature 
             icon={BarChart3} 
             title="Performance Insights" 
             desc="Comprehensive monitoring and query analysis to optimize your database performance." 
           />
           <Feature 
             icon={Cpu} 
             title="Infrastructure Agnostic" 
             desc="Deploy and manage clusters seamlessly across EKS, GKE, or on-premise Bare-metal nodes." 
           />
        </div>

        <div className="relative z-10 pt-8 border-t border-white/5">
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black">Powered by Poyraz-K8s Ecosystem</p>
        </div>
      </div>

      {/* Right Side: Login Section */}
      <div className="w-full lg:w-5/12 flex items-center justify-center p-8 bg-white dark:bg-[#020617]">
        <div className="w-full max-w-md">
          <div className="mb-10 space-y-3">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white font-outfit tracking-tight">Sign In</h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg">Manage your mission-critical databases.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 rounded-2xl text-sm text-red-600 dark:text-red-400 font-medium animate-in fade-in zoom-in-95">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Authentication Source</label>
              <div className="flex p-1.5 bg-slate-100 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                 <button 
                   type="button"
                   onClick={() => { setAuthType('local'); setError(''); }}
                   className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 ${authType === 'local' ? 'bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   <div className="flex items-center justify-center space-x-2">
                     <User className="w-3.5 h-3.5" />
                     <span>Local</span>
                   </div>
                 </button>
                 <button 
                   type="button"
                   onClick={() => { setAuthType('ldap'); setError(''); }}
                   className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 ${authType === 'ldap' ? 'bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   <div className="flex items-center justify-center space-x-2">
                     <Globe className="w-3.5 h-3.5" />
                     <span>LDAP</span>
                   </div>
                 </button>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Username</label>
                <div className="group relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" 
                    required 
                    placeholder={authType === 'ldap' ? 'Network ID' : 'Username'}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Password</label>
                <div className="group relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="password" 
                    required 
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl text-sm font-bold shadow-2xl shadow-blue-600/20 transition-all active:scale-[0.98] flex items-center justify-center h-[56px]"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Enter Platform'}
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500">
               Secured by enterprise-grade encryption. Need help? <a href="#" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Contact Support</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


interface FeatureProps {
  icon: LucideIcon;
  title: string;
  desc: string;
}

function Feature({ icon: Icon, title, desc }: FeatureProps) {
  return (
    <div className="flex flex-col space-y-3 group">
      <div className="w-12 h-12 bg-white/5 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10 group-hover:border-blue-500/50 transition-all duration-500">
        <Icon className="w-6 h-6 text-blue-400" />
      </div>
      <div className="space-y-1">
        <h4 className="text-base font-bold text-white tracking-tight">{title}</h4>
        <p className="text-sm text-slate-500 leading-relaxed font-light">{desc}</p>
      </div>
    </div>
  );
}
