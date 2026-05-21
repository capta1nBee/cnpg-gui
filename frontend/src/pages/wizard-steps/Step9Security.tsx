import React from 'react';
import { Users, Trash2, ShieldCheck, Clock, Network } from 'lucide-react';
import type { WizardFormData } from './types';
import { isValidK8sName, RoleCheckbox } from './shared';

interface Props {
  formData: WizardFormData;
  setFormData: (data: WizardFormData) => void;
}

const PREDEFINED_IN_ROLES = [
  { name: 'pg_read_all_data', description: 'Read all data (PostgreSQL 14+)' },
  { name: 'pg_write_all_data', description: 'Write all data (PostgreSQL 14+)' },
  { name: 'pg_read_all_settings', description: 'Read all configuration' },
  { name: 'pg_read_all_stats', description: 'Read all statistics' },
  { name: 'pg_monitor', description: 'Monitoring privileges' },
  { name: 'pg_signal_backend', description: 'Send signals to backends' },
];

export default function Step9Security({ formData, setFormData }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold dark:text-white font-outfit">Security & Access</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-sm font-bold dark:text-white uppercase tracking-wider mb-2">Bootstrap User</h3>
          <div className="p-6 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Admin Username</label>
              <input type="text" placeholder="appuser" className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.adminUsername} onChange={e => setFormData({ ...formData, adminUsername: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Admin Password</label>
              <input type="password" placeholder="••••••••" className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.adminPassword} onChange={e => setFormData({ ...formData, adminPassword: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold dark:text-white uppercase tracking-wider">Managed Roles</h3>
            <button onClick={() => setFormData({ ...formData, managedRoles: [...formData.managedRoles, { name: '', ensure: 'present', login: true, superuser: false, createdb: false, createrole: false, inherit: true, replication: false, bypassrls: false, connectionLimit: -1, comment: '', disablePassword: false, passwordSecret: '', password: '', validUntil: '', inRoles: [] }] })}
              className="px-4 py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 transition-all">
              + ADD NEW ROLE
            </button>
          </div>
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {formData.managedRoles.map((role, idx) => (
              <div key={idx} className="p-5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800 relative group animate-in zoom-in-95 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Role Name</label>
                    <input type="text" placeholder="e.g. read_only_user" className={`w-full p-2 bg-white dark:bg-gray-800 border rounded-lg text-xs dark:text-white outline-none focus:ring-2 focus:ring-blue-500 ${!isValidK8sName(role.name) && role.name ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                      value={role.name} onChange={e => {
                        const newRoles = [...formData.managedRoles];
                        newRoles[idx].name = e.target.value;
                        newRoles[idx].passwordSecret = `${formData.name}-${e.target.value}-auth`;
                        setFormData({ ...formData, managedRoles: newRoles });
                      }} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Password</label>
                    <input type="password" placeholder="••••••••" className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      value={role.password} onChange={e => {
                        const newRoles = [...formData.managedRoles];
                        newRoles[idx].password = e.target.value;
                        setFormData({ ...formData, managedRoles: newRoles });
                      }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <RoleCheckbox id={`login-${idx}`} label="Login" checked={role.login} onChange={v => { const n = [...formData.managedRoles]; n[idx].login = v; setFormData({ ...formData, managedRoles: n }); }} color="blue" />
                  <RoleCheckbox id={`super-${idx}`} label="Superuser" checked={role.superuser} onChange={v => { const n = [...formData.managedRoles]; n[idx].superuser = v; setFormData({ ...formData, managedRoles: n }); }} color="orange" />
                  <RoleCheckbox id={`db-${idx}`} label="Create DB" checked={role.createdb} onChange={v => { const n = [...formData.managedRoles]; n[idx].createdb = v; setFormData({ ...formData, managedRoles: n }); }} color="indigo" />
                  <RoleCheckbox id={`role-${idx}`} label="Create Role" checked={role.createrole} onChange={v => { const n = [...formData.managedRoles]; n[idx].createrole = v; setFormData({ ...formData, managedRoles: n }); }} color="purple" />
                  <RoleCheckbox id={`repl-${idx}`} label="Replication" checked={role.replication} onChange={v => { const n = [...formData.managedRoles]; n[idx].replication = v; setFormData({ ...formData, managedRoles: n }); }} color="sky" />
                  <RoleCheckbox id={`rls-${idx}`} label="Bypass RLS" checked={role.bypassrls} onChange={v => { const n = [...formData.managedRoles]; n[idx].bypassrls = v; setFormData({ ...formData, managedRoles: n }); }} color="violet" />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="flex items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      <Network className="w-3 h-3 mr-1" /> Connection Limit
                    </label>
                    <input type="number" className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                      value={role.connectionLimit} onChange={e => { const n = [...formData.managedRoles]; n[idx].connectionLimit = parseInt(e.target.value); setFormData({ ...formData, managedRoles: n }); }} />
                  </div>
                  <div>
                    <label className="flex items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      <Clock className="w-3 h-3 mr-1" /> Valid Until
                    </label>
                    <input type="datetime-local" className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                      value={role.validUntil} onChange={e => { const n = [...formData.managedRoles]; n[idx].validUntil = e.target.value; setFormData({ ...formData, managedRoles: n }); }} />
                  </div>
                </div>

                <div>
                  <label className="flex items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    <ShieldCheck className="w-3 h-3 mr-1" /> Inherit Predefined Roles
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_IN_ROLES.map(pr => (
                      <button key={pr.name} onClick={() => {
                        const n = [...formData.managedRoles];
                        const currentInRoles = n[idx].inRoles || [];
                        if (currentInRoles.includes(pr.name)) {
                          n[idx].inRoles = currentInRoles.filter(ir => ir !== pr.name);
                        } else {
                          n[idx].inRoles = [...currentInRoles, pr.name];
                        }
                        setFormData({ ...formData, managedRoles: n });
                      }} className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-all ${role.inRoles?.includes(pr.name) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-indigo-500'}`}>
                        {pr.name}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => setFormData({ ...formData, managedRoles: formData.managedRoles.filter((_, i) => i !== idx) })}
                  className="absolute top-4 right-4 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {formData.managedRoles.length === 0 && (
              <div className="p-8 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl text-center">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No managed roles defined yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
