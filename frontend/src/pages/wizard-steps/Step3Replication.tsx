import React from 'react';
import type { WizardFormData } from './types';

interface Props {
  formData: WizardFormData;
  setFormData: (data: WizardFormData) => void;
}

export default function Step3Replication({ formData, setFormData }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold dark:text-white font-outfit">Instances & Availability</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20">
          <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4">Instance Count</label>
          <div className="flex items-center space-x-6">
            <input type="number" min={1} max={10} className="w-24 p-4 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-xl dark:text-white text-3xl font-bold text-center shadow-sm"
              value={formData.instances} onChange={e => setFormData({ ...formData, instances: parseInt(e.target.value) })} />
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Minimum 3 for HA</p>
              <p className="text-xs text-gray-500">For production environments, 3 or more instances are recommended.</p>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl">
            <div>
              <h4 className="text-sm font-bold dark:text-white">Replication Mode</h4>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{formData.replicationMode === 'sync' ? 'Synchronous (No Data Loss)' : 'Asynchronous (High Performance)'}</p>
            </div>
            <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <button onClick={() => setFormData({ ...formData, replicationMode: 'sync' })} className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${formData.replicationMode === 'sync' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500'}`}>SYNC</button>
              <button onClick={() => setFormData({ ...formData, replicationMode: 'async' })} className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${formData.replicationMode === 'async' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500'}`}>ASYNC</button>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl">
            <div>
              <h4 className="text-sm font-bold dark:text-white">Auto-Failover</h4>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">High Availability</p>
            </div>
            <button onClick={() => setFormData({ ...formData, failoverEnable: !formData.failoverEnable })} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${formData.failoverEnable ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
              {formData.failoverEnable ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
