import React from 'react';
import { CheckCircle } from 'lucide-react';
import type { WizardFormData } from './types';
import { SummaryItem } from './shared';

interface Props {
  formData: WizardFormData;
  isYamlMode: boolean;
  setIsYamlMode: (v: boolean) => void;
  yamlContent: string;
  setYamlContent: (v: string) => void;
  generateYaml: () => string;
}

export default function Step10Review({ formData, isYamlMode, setIsYamlMode, yamlContent, setYamlContent, generateYaml }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold dark:text-white font-outfit">Review & Launch</h2>
        <button onClick={() => { setIsYamlMode(!isYamlMode); if (!isYamlMode) generateYaml(); }} className="px-4 py-1 text-xs font-bold bg-blue-50 text-blue-600 rounded-lg">
          {isYamlMode ? 'View Summary' : 'Edit YAML'}
        </button>
      </div>
      {isYamlMode ? (
        <textarea className="w-full h-96 p-6 font-mono text-xs bg-gray-900 text-blue-300 rounded-2xl border border-gray-800 outline-none focus:ring-2 focus:ring-blue-500/50"
          value={yamlContent} onChange={e => setYamlContent(e.target.value)} />
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3">Identity & Location</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryItem label="Name" value={formData.name} />
                <SummaryItem label="Namespace" value={formData.namespace} />
                <SummaryItem label="Database" value={formData.dbName} />
                <SummaryItem label="Version" value={`PostgreSQL ${formData.pgVersion}`} />
              </div>
            </div>

            <div className="md:col-span-3">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3 mt-4">Compute & HA</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryItem label="Instances" value={formData.instances.toString()} />
                <SummaryItem label="Storage" value={formData.storageSize} />
                <SummaryItem label="CPU / RAM" value={`${formData.cpuLimit} / ${formData.memoryLimit}`} />
                <SummaryItem label="Sync Repl" value={formData.syncReplication ? 'Enabled' : 'Disabled'} />
              </div>
            </div>

            <div className="md:col-span-3">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3 mt-4">Backup & Continuity</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryItem label="Backup" value={formData.backupEnabled ? 'Active (S3)' : 'Disabled'} />
                <SummaryItem label="PITR" value={formData.pitrEnabled ? 'Enabled' : 'Disabled'} />
                <SummaryItem label="Retention" value={formData.retentionPolicy} />
                <SummaryItem label="Schedule" value={formData.backupSchedule} />
              </div>
            </div>

            <div className="md:col-span-3">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3 mt-4">Security</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryItem label="Admin User" value={formData.adminUsername} />
                <SummaryItem label="Managed Roles" value={formData.managedRoles.length.toString()} />
                <SummaryItem label="Pooler" value={formData.poolers.length > 0 ? 'Enabled' : 'Disabled'} />
                <SummaryItem label="Superuser" value={formData.enableSuperuserAccess ? 'Allowed' : 'Restricted'} />
              </div>
            </div>
          </div>
          
          <div className="mt-8 p-6 bg-blue-600 rounded-2xl text-white flex items-center justify-between shadow-xl shadow-blue-500/20">
             <div className="flex items-center">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mr-4">
                   <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                   <p className="font-bold text-lg">Ready to Launch</p>
                   <p className="text-sm opacity-80 font-medium">Review the configuration above before provisioning.</p>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
