import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import type { WizardFormData } from './types';

interface Props {
  formData: WizardFormData;
  setFormData: (data: WizardFormData) => void;
}

export default function Step8PITR({ formData, setFormData }: Props) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between bg-violet-50/30 dark:bg-violet-900/10 p-6 rounded-2xl border border-violet-100 dark:border-violet-900/20">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-violet-600 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-violet-500/20">
            <RefreshCw className="w-6 h-6 text-white" />
          </div>
          <div>
            <h4 className="text-base font-bold dark:text-white">Point-In-Time Recovery (PITR)</h4>
            <p className="text-xs text-gray-500">Archive WAL logs to object store for recovery to any point in time.</p>
          </div>
        </div>
        <button onClick={() => setFormData({ ...formData, pitrEnabled: !formData.pitrEnabled })} className={`px-6 py-2 text-xs font-bold rounded-xl transition-all ${formData.pitrEnabled ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
          {formData.pitrEnabled ? 'ENABLED' : 'DISABLED'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-6 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl">
           <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Retention Policy</label>
           <div className="flex items-center space-x-3">
              <input type="text" className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white text-sm font-bold"
                value={formData.retentionPolicy} onChange={e => setFormData({ ...formData, retentionPolicy: e.target.value })} placeholder="e.g. 7d" />
           </div>
           <p className="text-[10px] text-gray-400 mt-2">Example: 7d (days), 4w (weeks)</p>
        </div>
        <div className="p-6 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl">
           <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">WAL Retention Days</label>
           <input type="number" className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white text-sm font-bold"
             value={formData.walRetentionDays} onChange={e => setFormData({ ...formData, walRetentionDays: parseInt(e.target.value) })} />
           <p className="text-[10px] text-gray-400 mt-2">Days to keep WAL logs in the object store.</p>
        </div>
      </div>

      <div className="p-6 bg-amber-50/20 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20">
         <div className="flex items-center space-x-3 mb-4 text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-5 h-5" />
            <h4 className="text-sm font-bold">Scheduled Backup Policy</h4>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
               <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Cron Schedule</label>
               <input type="text" className="w-full p-2 bg-white dark:bg-gray-800 border rounded-lg text-xs dark:text-white"
                 value={formData.backupSchedule} onChange={e => setFormData({ ...formData, backupSchedule: e.target.value })} />
            </div>
            <div>
               <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Owner Reference</label>
               <select className="w-full p-2 bg-white dark:bg-gray-800 border rounded-lg text-xs dark:text-white"
                 value={formData.backupOwnerReference} onChange={e => setFormData({ ...formData, backupOwnerReference: e.target.value as any })}>
                 <option value="cluster">Cluster (Cleanup on Delete)</option>
                 <option value="none">None (Keep Always)</option>
                 <option value="self">Self</option>
               </select>
            </div>
            <div className="flex items-end pb-1">
               <div className="flex items-center">
                  <input type="checkbox" id="immediate" className="w-4 h-4 rounded text-blue-600"
                    checked={formData.backupImmediate} onChange={e => setFormData({ ...formData, backupImmediate: e.target.checked })} />
                  <label htmlFor="immediate" className="ml-2 text-xs font-bold text-gray-600 dark:text-gray-400">Backup Immediately</label>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
