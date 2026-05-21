import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, RotateCcw, Target, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import api from '../api/axios';
import { useTenant } from '../context/TenantContext';
import { useUI } from '../context/UIContext';
import { useEffect } from 'react';

export default function RestoreWizard() {
  const { toast } = useUI();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    backupName: '',
    sourceClusterName: '',
    restoreType: 'Full',
    targetType: 'New',
    newClusterName: '',
    namespace: 'default',
    // PITR Targets
    targetTime: '',
    targetLSN: '',
    targetXID: '',
    targetName: '',
    targetImmediate: false,
    exclusive: false,
    backupID: '',
    method: 'barman' // or volumeSnapshot
  });
  const { activeEnvironmentId } = useTenant();
  const [backups, setBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBackups = async () => {
      if (!activeEnvironmentId) return;
      try {
        setLoadingBackups(true);
        const res = await api.get('/backups');
        setBackups(res.data);
      } catch (err) {
        console.error("Failed to fetch backups", err);
      } finally {
        setLoadingBackups(false);
      }
    };
    fetchBackups();
  }, [activeEnvironmentId]);

  const handleNext = () => setStep(prev => Math.min(prev + 1, 4));
  const handlePrev = () => setStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    try {
      await api.post('/backups/restore/pitr', { 
        ...formData,
        // Map any names if needed by backend
        sourceClusterName: formData.sourceClusterName || formData.backupName.split('-')[0] // heuristic if not set
      });
      toast('Restore process initiated.', 'success');
      navigate('/clusters');
    } catch (err) {
      toast('Restore failed to start.', 'error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-blue-600 p-8 text-white">
        <h1 className="text-2xl font-bold flex items-center">
          <RotateCcw className="w-8 h-8 mr-3" /> Restore Wizard
        </h1>
        <p className="text-blue-100 mt-2">Recover your database from a previous state.</p>
      </div>

      <div className="p-8">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold dark:text-white flex items-center">
              <Shield className="w-5 h-5 mr-2 text-blue-500" /> 1. Select Backup
            </h2>
            <div className="grid gap-3">
              {loadingBackups ? (
                <div className="text-center py-8 text-gray-500">Loading backups...</div>
              ) : backups.map(b => (
                <button key={b.name} onClick={() => setFormData({...formData, backupName: b.name, sourceClusterName: b.clusterName, namespace: b.namespace})}
                  className={`p-4 text-left border rounded-xl transition-all ${formData.backupName === b.name ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50'}`}>
                  <div className="flex justify-between items-center">
                    <p className="font-bold dark:text-white">{b.name}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 uppercase">{b.method || 'barman'}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Cluster: {b.clusterName} | Namespace: {b.namespace} | Created: {new Date(b.creationTimestamp).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold dark:text-white flex items-center">
               <RotateCcw className="w-5 h-5 mr-2 text-blue-500" /> 2. Restore Type
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <button onClick={() => setFormData({...formData, restoreType: 'Full'})}
                  className={`w-full p-6 border rounded-2xl text-left transition-all ${formData.restoreType === 'Full' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10 shadow-lg shadow-blue-500/10' : 'dark:border-gray-700'}`}>
                  <h3 className="font-bold dark:text-white">Full Recovery</h3>
                  <p className="text-[10px] text-gray-500 mt-1">Restore the complete snapshot state.</p>
                </button>
                <button onClick={() => setFormData({...formData, restoreType: 'PITR'})}
                  className={`w-full p-6 border rounded-2xl text-left transition-all ${formData.restoreType === 'PITR' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10 shadow-lg shadow-indigo-500/10' : 'dark:border-gray-700'}`}>
                  <h3 className="font-bold dark:text-white">Point-in-Time (PITR)</h3>
                  <p className="text-[10px] text-gray-500 mt-1">Recover to a specific LSN, XID, or Time.</p>
                </button>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Recovery Method</label>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => setFormData({...formData, method: 'barman'})} 
                    className={`p-3 text-xs font-bold border rounded-xl ${formData.method === 'barman' ? 'bg-blue-600 text-white border-blue-600' : 'dark:text-gray-400 dark:border-gray-700'}`}>
                    Barman (Object Store)
                  </button>
                  <button onClick={() => setFormData({...formData, method: 'volumeSnapshot'})}
                    className={`p-3 text-xs font-bold border rounded-xl ${formData.method === 'volumeSnapshot' ? 'bg-blue-600 text-white border-blue-600' : 'dark:text-gray-400 dark:border-gray-700'}`}>
                    Volume Snapshot
                  </button>
                </div>
              </div>
            </div>

            {formData.restoreType === 'PITR' && (
              <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4 animate-in slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Target Time</label>
                    <input type="datetime-local" className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                           value={formData.targetTime} onChange={e => setFormData({...formData, targetTime: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Target LSN</label>
                    <input type="text" placeholder="e.g. 0/3000000" className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white font-mono"
                           value={formData.targetLSN} onChange={e => setFormData({...formData, targetLSN: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Target XID</label>
                    <input type="text" placeholder="e.g. 100" className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white font-mono"
                           value={formData.targetXID} onChange={e => setFormData({...formData, targetXID: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Target Name</label>
                    <input type="text" placeholder="Restore point name" className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
                           value={formData.targetName} onChange={e => setFormData({...formData, targetName: e.target.value})} />
                  </div>
                </div>
                <div className="flex items-center space-x-6 pt-2">
                   <div className="flex items-center space-x-2">
                     <input type="checkbox" id="immediate" checked={formData.targetImmediate} onChange={e => setFormData({...formData, targetImmediate: e.target.checked})} className="w-4 h-4 rounded text-blue-600" />
                     <label htmlFor="immediate" className="text-[10px] font-bold text-gray-600 uppercase">Immediate</label>
                   </div>
                   <div className="flex items-center space-x-2">
                     <input type="checkbox" id="exclusive" checked={formData.exclusive} onChange={e => setFormData({...formData, exclusive: e.target.checked})} className="w-4 h-4 rounded text-blue-600" />
                     <label htmlFor="exclusive" className="text-[10px] font-bold text-gray-600 uppercase">Exclusive</label>
                   </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold dark:text-white flex items-center">
              <Target className="w-5 h-5 mr-2 text-blue-500" /> 3. Target Destination
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Cluster Name</label>
              <input type="text" className="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:text-white"
                     value={formData.newClusterName} onChange={e => setFormData({...formData, newClusterName: e.target.value})} placeholder="pg-restored-v1" />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold dark:text-white">Ready to Restore</h2>
            <p className="text-gray-500">Please confirm your restore settings.</p>
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl text-left inline-block w-full max-w-sm border border-gray-100">
               <p className="text-sm"><strong>Source:</strong> {formData.backupName}</p>
               <p className="text-sm"><strong>Type:</strong> {formData.restoreType}</p>
               <p className="text-sm"><strong>Target:</strong> {formData.newClusterName}</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-8 bg-gray-50 dark:bg-gray-900 flex justify-between">
        <button onClick={handlePrev} disabled={step === 1} className="flex items-center px-4 py-2 text-gray-600 disabled:opacity-30">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </button>
        {step < 4 ? (
          <button onClick={handleNext} disabled={!formData.backupName} className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Next <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        ) : (
          <button onClick={handleSubmit} className="flex items-center px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold">
            Confirm & Start Restore
          </button>
        )}
      </div>
    </div>
  );
}
