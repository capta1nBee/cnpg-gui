import React from 'react';
import { CheckCircle } from 'lucide-react';

export function isValidK8sName(name: string) {
  if (!name) return true;
  return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/.test(name);
}

interface RoleCheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color: string;
}

export function RoleCheckbox({ id, label, checked, onChange, color }: RoleCheckboxProps) {
  const bgColors: Record<string, string> = {
    blue: 'bg-blue-500 border-blue-500',
    indigo: 'bg-indigo-500 border-indigo-500',
    sky: 'bg-sky-500 border-sky-500',
    violet: 'bg-violet-500 border-violet-500',
    orange: 'bg-orange-500 border-orange-500',
    purple: 'bg-purple-500 border-purple-500',
  };

  return (
    <div className="flex items-center group cursor-pointer select-none" onClick={() => onChange(!checked)}>
      <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${checked ? bgColors[color] || 'bg-blue-500 border-blue-500' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 group-hover:border-gray-300'}`}>
        {checked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
      </div>
      <label className={`ml-3 text-[12px] font-bold transition-colors ${checked ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
        {label}
      </label>
    </div>
  );
}

export function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl">
      <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{label}</span>
      <span className="text-sm font-bold dark:text-white">{value}</span>
    </div>
  );
}
