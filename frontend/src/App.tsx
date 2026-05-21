import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Database, Server, Settings, Users, Shield, LayoutDashboard, TerminalSquare, Bell, Activity, HardDrive, BarChart3, Globe, Mail, type LucideIcon } from 'lucide-react';
import { TenantProvider, useTenant } from './context/TenantContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import ProtectedRoute from './ProtectedRoute';
import api from './api/axios';
import { LogOut } from 'lucide-react';

import LoginPage from './pages/LoginPage';
import ClusterList from './pages/ClusterList';
import ClusterDetail from './pages/ClusterDetail';
import ClusterWizard from './pages/ClusterWizard';
import BackupList from './pages/BackupList';
import QueryEditor from './pages/QueryEditor';
import UserList from './pages/UserList';
import TenantList from './pages/TenantList';
import RestoreWizard from './pages/RestoreWizard';
import EnvironmentList from './pages/EnvironmentList';
import ProfileSettings from './pages/ProfileSettings';
import AuditLogs from './pages/AuditLogs';
import AlertSettings from './pages/AlertSettings';
import LDAPSettings from './pages/LDAPSettings';
import EmailSettings from './pages/EmailSettings';
import Dashboard from './pages/Dashboard';

import logo from './assets/logo.svg';

function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { environments, activeEnvironmentId, setActiveEnvironmentId } = useTenant();
  const { user, logout } = useAuth();

  // RBAC Flags
  const isSuperAdmin = user?.role?.toUpperCase() === 'SUPERADMIN';
  const isAdminOrSuper = user?.role?.toUpperCase() === 'SUPERADMIN' || user?.role?.toUpperCase() === 'ADMIN';

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#020617] overflow-hidden">
      {/* Premium Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white dark:bg-[#0B1120] border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-gray-800">
          <div className="w-9 h-9 bg-white dark:bg-white p-1.5 rounded-xl flex items-center justify-center mr-3 shadow-xl shadow-blue-500/10">
            <img src={logo} alt="Logo" className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white font-outfit">Poyraz-CNPG</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2">Main Menu</div>
          <SidebarLink to="/" icon={LayoutDashboard} label="Dashboard" active={location.pathname === '/'} />
          <SidebarLink to="/clusters" icon={Server} label="Clusters" active={location.pathname.startsWith('/clusters')} />
          <SidebarLink to="/backups" icon={Shield} label="Backup & Recovery" active={location.pathname === '/backups'} />
          
          {/* SQL Workbench only for ADMIN and SUPERADMIN */}
          {isAdminOrSuper && (
            <SidebarLink to="/query" icon={TerminalSquare} label="SQL Workbench" active={location.pathname === '/query'} />
          )}
          
          <SidebarLink to="/alerts" icon={Bell} label="Alerts & Monitoring" active={location.pathname === '/alerts'} />
          
          <div className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2">Administration</div>
            
            {/* SUPERADMIN Only Sections */}
            {isSuperAdmin && (
              <>
                <SidebarLink to="/users" icon={Users} label="User Access" active={location.pathname === '/users'} />
                <SidebarLink to="/tenants" icon={Globe} label="Tenants" active={location.pathname === '/tenants'} />
                <SidebarLink to="/audit" icon={Shield} label="Audit Logs" active={location.pathname === '/audit'} />
                
                <div className="mt-4 px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">System Settings</div>
                <SidebarLink to="/settings/ldap" icon={Settings} label="LDAP Auth" active={location.pathname === '/settings/ldap'} />
                <SidebarLink to="/settings/email" icon={Mail} label="Email Config" active={location.pathname === '/settings/email'} />
              </>
            )}
            
            {/* If NOT SuperAdmin, they can still see Tenants but maybe not manage? 
                Actually the user said Superadmin sees Tenants. 
                I will hide it for others to follow the list strictly. */}
          </div>
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
                {user?.username?.substring(0, 2).toUpperCase() || 'AD'}
              </div>
              <div className="ml-3 overflow-hidden">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{user?.username || 'Admin'}</p>
                <p className="text-[10px] text-gray-500 truncate">{user?.role || 'USER'}</p>
              </div>
            </div>
            <button 
              onClick={logout}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navigation */}
        <header className="h-16 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-gray-100 dark:bg-gray-800/50 rounded-xl p-1.5 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mr-2">
                <Globe className="w-4 h-4" />
              </div>
              <div className="relative group">
                <select 
                  value={activeEnvironmentId || ''}
                  onChange={(e) => setActiveEnvironmentId(e.target.value)}
                  className="appearance-none bg-transparent border-none text-sm font-bold text-gray-900 dark:text-white focus:ring-0 cursor-pointer pr-8 pl-2 outline-none w-48 truncate"
                >
                  {environments.length === 0 ? (
                    <option value="" disabled>No Tenants Found</option>
                  ) : (
                    environments.map(env => (
                      <option key={env.id} value={env.id}>{env.name}</option>
                    ))
                  )}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors relative">
               <Bell className="w-5 h-5" />
               <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-[#0B1120]"></span>
            </button>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-800"></div>
            <button className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">Support</button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}

interface SidebarLinkProps {
  to: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}

function SidebarLink({ to, icon: Icon, label, active }: SidebarLinkProps) {
  return (
    <Link to={to} className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${active 
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'}`}>
      <Icon className={`w-5 h-5 mr-3 ${active ? 'text-white' : 'text-gray-400'}`} />
      {label}
    </Link>
  );
}



function App() {
  return (
    <UIProvider>
      <AuthProvider>
        <TenantProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><AdminLayout><Dashboard /></AdminLayout></ProtectedRoute>} />
            <Route path="/clusters" element={<ProtectedRoute><AdminLayout><ClusterList /></AdminLayout></ProtectedRoute>} />
            <Route path="/clusters/new" element={<ProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN']}><AdminLayout><ClusterWizard /></AdminLayout></ProtectedRoute>} />
            <Route path="/clusters/edit/:namespace/:name" element={<ProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN']}><AdminLayout><ClusterWizard /></AdminLayout></ProtectedRoute>} />
            <Route path="/clusters/:namespace/:name" element={<ProtectedRoute><AdminLayout><ClusterDetail /></AdminLayout></ProtectedRoute>} />
            <Route path="/backups" element={<ProtectedRoute><AdminLayout><BackupList /></AdminLayout></ProtectedRoute>} />
            <Route path="/query" element={<ProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN']}><AdminLayout><QueryEditor /></AdminLayout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute allowedRoles={['SUPERADMIN']}><AdminLayout><UserList /></AdminLayout></ProtectedRoute>} />
            <Route path="/tenants" element={<ProtectedRoute allowedRoles={['SUPERADMIN']}><AdminLayout><TenantList /></AdminLayout></ProtectedRoute>} />
            <Route path="/restore" element={<ProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN']}><AdminLayout><RestoreWizard /></AdminLayout></ProtectedRoute>} />
            <Route path="/environments" element={<ProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN']}><AdminLayout><EnvironmentList /></AdminLayout></ProtectedRoute>} />
            <Route path="/settings/profile" element={<ProtectedRoute><AdminLayout><ProfileSettings /></AdminLayout></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute allowedRoles={['SUPERADMIN']}><AdminLayout><AuditLogs /></AdminLayout></ProtectedRoute>} />
            <Route path="/alerts" element={<ProtectedRoute><AdminLayout><AlertSettings /></AdminLayout></ProtectedRoute>} />
            <Route path="/settings/ldap" element={<ProtectedRoute allowedRoles={['SUPERADMIN']}><AdminLayout><LDAPSettings /></AdminLayout></ProtectedRoute>} />
            <Route path="/settings/email" element={<ProtectedRoute allowedRoles={['SUPERADMIN']}><AdminLayout><EmailSettings /></AdminLayout></ProtectedRoute>} />
          </Routes>
        </TenantProvider>
      </AuthProvider>
    </UIProvider>
  );
}

export default App;
