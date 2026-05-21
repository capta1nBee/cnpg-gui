import React from 'react';
import { Shield } from 'lucide-react';
import type { WizardFormData } from './types';

interface Props {
  formData: WizardFormData;
  setFormData: (data: WizardFormData) => void;
  testS3: () => void;
  isTestingS3: boolean;
  s3TestResult: { success: boolean; message: string } | null;
}

export default function Step7Backup({ formData, setFormData, testS3, isTestingS3, s3TestResult }: Props) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between bg-emerald-50/30 dark:bg-emerald-900/10 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/20">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-emerald-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h4 className="text-base font-bold dark:text-white">Continuous Backup</h4>
            <p className="text-xs text-gray-500">Enable Barman Cloud for object store backups (S3/Minio).</p>
          </div>
        </div>
        <button onClick={() => setFormData({ ...formData, backupEnabled: !formData.backupEnabled })} className={`px-6 py-2 text-xs font-bold rounded-xl transition-all ${formData.backupEnabled ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
          {formData.backupEnabled ? 'ENABLED' : 'DISABLED'}
        </button>
      </div>

      {formData.backupEnabled && (
        <div className="space-y-6 animate-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Endpoint URL</label>
              <input type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl dark:text-white text-sm"
                value={formData.endpointUrl} onChange={e => setFormData({ ...formData, endpointUrl: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Bucket Name</label>
              <input type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl dark:text-white text-sm"
                value={formData.bucketName} onChange={e => setFormData({ ...formData, bucketName: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Access Key ID</label>
              <input type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl dark:text-white text-sm"
                value={formData.s3AccessKey} onChange={e => setFormData({ ...formData, s3AccessKey: e.target.value })} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Secret Access Key</label>
              <input type="password" name="s3SecretKey" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl dark:text-white text-sm"
                value={formData.s3SecretKey} onChange={e => setFormData({ ...formData, s3SecretKey: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center space-x-8 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center">
              <input type="checkbox" id="skipVerify" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                checked={formData.skipVerify} onChange={e => setFormData({ ...formData, skipVerify: e.target.checked })} />
              <label htmlFor="skipVerify" className="ml-2 text-xs font-bold text-gray-600 dark:text-gray-400">Skip SSL Verification</label>
            </div>
            <div className="flex-1 flex items-center justify-end space-x-3">
               <button onClick={testS3} disabled={isTestingS3} className="px-4 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 transition-all">
                  {isTestingS3 ? 'Testing...' : 'Test Connection'}
               </button>
               {s3TestResult && (
                 <span className={`text-[10px] font-bold ${s3TestResult.success ? 'text-emerald-500' : 'text-red-500'}`}>{s3TestResult.message}</span>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
