import React, { useState, useEffect } from 'react';
import api from '../api/axios';

export default function EnvironmentList() {
  const [envs, setEnvs] = useState<any[]>([]);

  useEffect(() => {
    api.get('/environments').then(res => setEnvs(res.data)).catch(console.error);
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">K8s Environments</h1>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">+ Add Environment</button>
      </div>
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden p-4">
        {envs.map((env, i) => (
          <div key={i} className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 py-4">
            <div className="dark:text-white font-medium">{env.name}</div>
            <div className="text-sm text-green-500 font-bold">{env.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
