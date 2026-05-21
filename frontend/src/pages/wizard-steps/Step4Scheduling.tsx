import React from 'react';
import { Shield } from 'lucide-react';
import type { WizardFormData } from './types';

interface Props {
  formData: WizardFormData;
  setFormData: (data: WizardFormData) => void;
}

export default function Step4Scheduling({ formData, setFormData }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold dark:text-white font-outfit">Advanced Scheduling</h2>
      <div className="space-y-8">
        <div className="flex items-center justify-between bg-blue-50/30 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/20">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-blue-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="text-base font-bold dark:text-white">Pod Anti-Affinity</h4>
              <p className="text-xs text-gray-500">Distribute instances across different physical nodes.</p>
            </div>
          </div>
          <button onClick={() => setFormData({ ...formData, enablePodAntiAffinity: !formData.enablePodAntiAffinity })}
            className={`px-6 py-2 text-xs font-bold rounded-xl transition-all ${formData.enablePodAntiAffinity ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
            {formData.enablePodAntiAffinity ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>

        {formData.enablePodAntiAffinity && (
          <div className="grid grid-cols-2 gap-6 animate-in slide-in-from-top-2">
             <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Topology Key</label>
                <input type="text" className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl dark:text-white text-sm"
                  value={formData.topologyKey} onChange={e => setFormData({ ...formData, topologyKey: e.target.value })} />
             </div>
             <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Policy Type</label>
                <select className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl dark:text-white text-sm"
                  value={formData.antiAffinityType} onChange={e => setFormData({ ...formData, antiAffinityType: e.target.value as any })}>
                  <option value="preferred">Preferred (Soft)</option>
                  <option value="required">Required (Hard)</option>
                </select>
             </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="space-y-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Node Selector</label>
              {formData.nodeSelector.map((ns, idx) => (
                <div key={idx} className="flex space-x-2">
                  <input type="text" placeholder="key" className="flex-1 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs dark:text-white" value={ns.key} onChange={e => { const n = [...formData.nodeSelector]; n[idx].key = e.target.value; setFormData({ ...formData, nodeSelector: n }); }} />
                  <input type="text" placeholder="value" className="flex-1 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs dark:text-white" value={ns.value} onChange={e => { const n = [...formData.nodeSelector]; n[idx].value = e.target.value; setFormData({ ...formData, nodeSelector: n }); }} />
                  <button onClick={() => setFormData({ ...formData, nodeSelector: formData.nodeSelector.filter((_, i) => i !== idx) })} className="text-red-500">×</button>
                </div>
              ))}
              <button onClick={() => setFormData({ ...formData, nodeSelector: [...formData.nodeSelector, { key: '', value: '' }] })} className="text-[10px] font-bold text-blue-600">+ ADD SELECTOR</button>
           </div>
           <div className="space-y-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Tolerations</label>
              {formData.tolerations.map((t, idx) => (
                <div key={idx} className="flex space-x-2">
                  <input type="text" placeholder="key" className="flex-1 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs dark:text-white" value={t.key} onChange={e => { const n = [...formData.tolerations]; n[idx].key = e.target.value; setFormData({ ...formData, tolerations: n }); }} />
                  <select className="p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-[10px] dark:text-white" value={t.effect} onChange={e => { const n = [...formData.tolerations]; n[idx].effect = e.target.value; setFormData({ ...formData, tolerations: n }); }}>
                     <option value="NoSchedule">NoSchedule</option>
                     <option value="PreferNoSchedule">PreferNoSchedule</option>
                     <option value="NoExecute">NoExecute</option>
                  </select>
                  <button onClick={() => setFormData({ ...formData, tolerations: formData.tolerations.filter((_, i) => i !== idx) })} className="text-red-500">×</button>
                </div>
              ))}
              <button onClick={() => setFormData({ ...formData, tolerations: [...formData.tolerations, { key: '', operator: 'Exists', effect: 'NoSchedule' }] })} className="text-[10px] font-bold text-indigo-600">+ ADD TOLERATION</button>
           </div>
        </div>
      </div>
    </div>
  );
}
