import React from 'react';
import { HardDrive, Layers, Trash2 } from 'lucide-react';
import type { WizardFormData } from './types';

interface Props {
  formData: WizardFormData;
  setFormData: (data: WizardFormData) => void;
  storageClasses: string[];
}

export default function Step2Compute({ formData, setFormData, storageClasses }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold dark:text-white font-outfit">Compute & Storage</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Storage Size</label>
            <div className="relative">
              <HardDrive className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="e.g. 10Gi" className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
                value={formData.storageSize} onChange={e => setFormData({ ...formData, storageSize: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Storage Class</label>
            <select className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
              value={formData.storageClass} onChange={e => setFormData({ ...formData, storageClass: e.target.value })}>
              {storageClasses.map(sc => <option key={sc} value={sc}>{sc}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">CPU Limit</label>
                <input type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl dark:text-white"
                  value={formData.cpuLimit} onChange={e => setFormData({ ...formData, cpuLimit: e.target.value })} placeholder="e.g. 1" />
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Memory Limit</label>
                <input type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl dark:text-white"
                  value={formData.memoryLimit} onChange={e => setFormData({ ...formData, memoryLimit: e.target.value })} placeholder="e.g. 2Gi" />
             </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Shared Memory Limit (SHM)</label>
            <input type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl dark:text-white"
              value={formData.shmLimit} onChange={e => setFormData({ ...formData, shmLimit: e.target.value })} placeholder="e.g. 1Gi" />
          </div>
        </div>
      </div>
      <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold dark:text-white flex items-center">
            <Layers className="w-5 h-5 mr-2 text-blue-500" /> Additional Tablespaces
          </h3>
        </div>
        <div className="space-y-4">
          {formData.tablespaces.map((ts, idx) => (
            <div key={idx} className="grid grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
              <input type="text" className="w-full p-2 bg-white dark:bg-gray-800 border rounded-lg text-sm dark:text-white"
                value={ts.name} onChange={e => {
                  const newTs = [...formData.tablespaces];
                  newTs[idx].name = e.target.value;
                  setFormData({ ...formData, tablespaces: newTs });
                }} placeholder="tbs1" />
              <input type="text" className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                value={ts.size} onChange={e => {
                  const newTs = [...formData.tablespaces];
                  newTs[idx].size = e.target.value;
                  setFormData({ ...formData, tablespaces: newTs });
                }} placeholder="1Gi" />
              <input type="text" className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                value={ts.owner} onChange={e => {
                  const newTs = [...formData.tablespaces];
                  newTs[idx].owner = e.target.value;
                  setFormData({ ...formData, tablespaces: newTs });
                }} placeholder="postgres" />
              <div className="flex items-center space-x-2">
                <input type="checkbox" id={`ts-tmp-${idx}`} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  checked={ts.temporary} onChange={e => {
                    const newTs = [...formData.tablespaces];
                    newTs[idx].temporary = e.target.checked;
                    setFormData({ ...formData, tablespaces: newTs });
                  }} />
                <label htmlFor={`ts-tmp-${idx}`} className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">TMP</label>
                <button onClick={() => setFormData({ ...formData, tablespaces: formData.tablespaces.filter((_, i) => i !== idx) })}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-auto">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <button onClick={() => setFormData({ ...formData, tablespaces: [...formData.tablespaces, { name: '', size: '10Gi', storageClass: formData.storageClass, temporary: false, owner: '' }] })}
            className="mt-4 flex items-center px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 transition-all">
            + Add Additional Tablespace
          </button>
        </div>
      </div>
    </div>
  );
}
