import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { WizardFormData } from './types';
import { isValidK8sName } from './shared';

interface Props {
  formData: WizardFormData;
  setFormData: (data: WizardFormData) => void;
  namespaces: string[];
  availableClusters: any[];
  isEditMode: boolean;
  name?: string;
  namespace?: string;
}

export default function Step1General({ formData, setFormData, namespaces, availableClusters, isEditMode, name, namespace }: Props) {
  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold dark:text-white font-outfit">
        {isEditMode ? 'Modify Identity' : 'Deployment Basics'}
      </h2>
      <p className="text-gray-500 text-sm">
        {isEditMode ? `Updating configuration for ${name} in ${namespace}.` : 'Define the identity and location of your new cluster.'}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Cluster Name</label>
          <input type="text" className={`w-full p-3 bg-gray-50 dark:bg-gray-900 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white ${!isValidK8sName(formData.name) && formData.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-gray-800'}`}
            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. billing-db-prod" />
          {!isValidK8sName(formData.name) && formData.name && (
            <p className="text-[10px] text-red-500 mt-1.5 font-medium animate-in fade-in slide-in-from-top-1">
              Invalid name. Use lowercase alphanumeric characters, '-' or '.', starting and ending with an alphanumeric character.
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Namespace</label>
          <select className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
            value={formData.namespace} onChange={e => setFormData({ ...formData, namespace: e.target.value })}>
            {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Initial Database Name</label>
          <input type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
            value={formData.dbName} onChange={e => setFormData({ ...formData, dbName: e.target.value })} placeholder="e.g. app_db" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tags / Labels</label>
        {formData.labels.map((label, idx) => (
          <div key={idx} className="flex space-x-3 mt-3">
            <input type="text" className="flex-1 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none dark:text-white"
              value={label.key} onChange={e => {
                const newLabels = [...formData.labels];
                newLabels[idx].key = e.target.value;
                setFormData({ ...formData, labels: newLabels });
              }} placeholder="key" />
            <input type="text" className="flex-1 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none dark:text-white"
              value={label.value} onChange={e => {
                const newLabels = [...formData.labels];
                newLabels[idx].value = e.target.value;
                setFormData({ ...formData, labels: newLabels });
              }} placeholder="value" />
          </div>
        ))}
        <button onClick={() => setFormData({ ...formData, labels: [...formData.labels, { key: '', value: '' }] })}
          className="mt-4 text-xs font-bold text-blue-600 hover:underline">+ Add Custom Label</button>
      </div>
      <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold dark:text-white flex items-center">
              <RefreshCw className="w-5 h-5 mr-2 text-indigo-500" /> Replica Mode
            </h3>
            <p className="text-[10px] text-gray-500">Deploy this cluster as a standby of another instance.</p>
          </div>
          <div className="flex items-center space-x-3 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-100 dark:border-gray-700">
            <button onClick={() => setFormData({ ...formData, replicaEnabled: true })} className={`px-4 py-1 text-[10px] font-bold rounded-md ${formData.replicaEnabled ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-gray-500'}`}>ENABLED</button>
            <button onClick={() => setFormData({ ...formData, replicaEnabled: false })} className={`px-4 py-1 text-[10px] font-bold rounded-md ${!formData.replicaEnabled ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-600' : 'text-gray-500'}`}>DISABLED</button>
          </div>
        </div>
        {formData.replicaEnabled && (
          <div className="space-y-4 animate-in slide-in-from-top-2">
            <select className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none dark:text-white"
              value={formData.replicaSource} onChange={e => setFormData({ ...formData, replicaSource: e.target.value })}>
              <option value="">Select a source cluster...</option>
              {availableClusters.filter(c => c.namespace === formData.namespace).map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
