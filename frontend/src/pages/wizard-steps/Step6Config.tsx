import React from 'react';
import type { WizardFormData } from './types';
import { Lock } from 'lucide-react';

interface Props {
  formData: WizardFormData;
  setFormData: (data: WizardFormData) => void;
  fixedParameters: Record<string, string>;
}

export default function Step6Config({ formData, setFormData, fixedParameters }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold dark:text-white font-outfit">Engine Configuration</h2>
      <div className="space-y-8">
        {/* Fixed Parameters (Read-Only) */}
        <div className="bg-amber-50/30 dark:bg-amber-900/10 p-6 rounded-2xl border border-amber-100 dark:border-amber-900/20">
          <div className="flex items-center mb-4 text-amber-600 dark:text-amber-400">
            <Lock className="w-5 h-5 mr-2" />
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest leading-none">Operator Controlled Parameters</h3>
              <p className="text-[10px] opacity-70 mt-1 font-medium italic">These parameters are managed exclusively by the CNPG operator and cannot be modified.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(fixedParameters).map(([key, value]) => (
              <div key={key} className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-amber-100/50 dark:border-amber-900/20">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{key}</p>
                <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold dark:text-white uppercase tracking-widest">Custom Parameters</h3>
            <button onClick={() => setFormData({ ...formData, pgParameters: [...formData.pgParameters, { key: '', value: '' }] })}
              className="flex items-center px-3 py-1.5 text-[10px] font-bold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700">
              + ADD PARAMETER
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.pgParameters.map((p, idx) => {
              const isFixed = Object.keys(fixedParameters).includes(p.key);
              return (
              <div key={idx} className={`flex items-center space-x-2 p-2 rounded-xl border shadow-sm ${isFixed ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                <input type="text" placeholder="key" className={`flex-1 p-2 bg-transparent text-xs outline-none ${isFixed ? 'text-red-600 dark:text-red-400 line-through' : 'dark:text-white'}`}
                  value={p.key} readOnly={isFixed} onChange={e => { const np = [...formData.pgParameters]; np[idx].key = e.target.value; setFormData({ ...formData, pgParameters: np }); }} />
                <div className="w-px h-4 bg-gray-200 dark:bg-gray-700"></div>
                <input type="text" placeholder="value" className={`flex-1 p-2 bg-transparent text-xs outline-none ${isFixed ? 'text-red-400 italic cursor-not-allowed' : 'dark:text-white'}`}
                  value={isFixed ? 'Operator Controlled' : p.value} readOnly={isFixed} onChange={e => { if (!isFixed) { const np = [...formData.pgParameters]; np[idx].value = e.target.value; setFormData({ ...formData, pgParameters: np }); } }} />
                {isFixed && <Lock className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                {!isFixed && <button onClick={() => setFormData({ ...formData, pgParameters: formData.pgParameters.filter((_, i) => i !== idx) })} className="p-1 text-red-500">×</button>}
              </div>
              );
            })}
          </div>
          {formData.pgParameters.some(p => Object.keys(fixedParameters).includes(p.key)) && (
            <p className="text-[10px] text-red-500 mt-3 font-medium">⚠ Parameters marked in red are managed by the CNPG operator and will be ignored during deployment.</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">PG_HBA Config</label>
            <textarea className="w-full h-32 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl font-mono text-xs dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="host all all 0.0.0.0/0 md5"
              value={formData.pgHba.join('\n')}
              onChange={e => setFormData({ ...formData, pgHba: e.target.value.split('\n') })} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">PG_IDENT Config</label>
            <textarea className="w-full h-32 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl font-mono text-xs dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="map-name system-user pg-user"
              value={formData.pgIdent.join('\n')}
              onChange={e => setFormData({ ...formData, pgIdent: e.target.value.split('\n') })} />
          </div>
        </div>
      </div>
    </div>
  );
}
