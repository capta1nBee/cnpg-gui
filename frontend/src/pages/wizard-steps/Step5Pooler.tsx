import React, { useState } from 'react';
import { Layers, Trash2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import type { WizardFormData, PoolerConfig } from './types';

interface Props {
  formData: WizardFormData;
  setFormData: (data: WizardFormData) => void;
}

const defaultPgbouncerParams: PoolerConfig['pgbouncerParams'] = {
  ignore_startup_parameters: 'extra_float_digits,options',
  log_stats: '0',
};

const defaultPooler = (): PoolerConfig => ({
  type: 'rw',
  instances: 2,
  poolMode: 'session',
  maxConnections: 100,
  pgbouncerParams: { ...defaultPgbouncerParams },
});

// ---------- helper types ----------
type ParamDef = {
  key: keyof PoolerConfig['pgbouncerParams'];
  label: string;
  placeholder?: string;
  hint?: string;
  type?: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
};

const BOOL_OPTIONS = [
  { value: '', label: '— default —' },
  { value: '1', label: '1 (enabled)' },
  { value: '0', label: '0 (disabled)' },
];

const PARAM_GROUPS: { title: string; params: ParamDef[] }[] = [
  {
    title: 'Pool Sizing',
    params: [
      { key: 'default_pool_size', label: 'default_pool_size', type: 'number', placeholder: 'e.g. 20', hint: 'How many server connections to allow per user/database pair.' },
      { key: 'min_pool_size', label: 'min_pool_size', type: 'number', placeholder: 'e.g. 0' },
      { key: 'max_db_connections', label: 'max_db_connections', type: 'number', placeholder: 'e.g. 0' },
      { key: 'max_user_connections', label: 'max_user_connections', type: 'number', placeholder: 'e.g. 0' },
      { key: 'reserve_pool_size', label: 'reserve_pool_size', type: 'number', placeholder: 'e.g. 0' },
      { key: 'reserve_pool_timeout', label: 'reserve_pool_timeout', type: 'number', placeholder: 'seconds' },
    ],
  },
  {
    title: 'Timeouts',
    params: [
      { key: 'query_timeout', label: 'query_timeout', type: 'number', placeholder: 'seconds' },
      { key: 'query_wait_timeout', label: 'query_wait_timeout', type: 'number', placeholder: 'seconds' },
      { key: 'client_idle_timeout', label: 'client_idle_timeout', type: 'number', placeholder: 'seconds' },
      { key: 'client_login_timeout', label: 'client_login_timeout', type: 'number', placeholder: 'seconds' },
      { key: 'idle_transaction_timeout', label: 'idle_transaction_timeout', type: 'number', placeholder: 'seconds' },
      { key: 'autodb_idle_timeout', label: 'autodb_idle_timeout', type: 'number', placeholder: 'seconds' },
    ],
  },
  {
    title: 'Server Connection',
    params: [
      { key: 'server_lifetime', label: 'server_lifetime', type: 'number', placeholder: 'seconds' },
      { key: 'server_idle_timeout', label: 'server_idle_timeout', type: 'number', placeholder: 'seconds' },
      { key: 'server_connect_timeout', label: 'server_connect_timeout', type: 'number', placeholder: 'seconds' },
      { key: 'server_login_retry', label: 'server_login_retry', type: 'number', placeholder: 'seconds' },
      { key: 'server_check_delay', label: 'server_check_delay', type: 'number', placeholder: 'seconds' },
      { key: 'server_check_query', label: 'server_check_query', type: 'text', placeholder: 'e.g. select 1' },
      { key: 'server_reset_query', label: 'server_reset_query', type: 'text', placeholder: 'e.g. DISCARD ALL' },
      { key: 'server_reset_query_always', label: 'server_reset_query_always', type: 'select', options: BOOL_OPTIONS },
      { key: 'server_fast_close', label: 'server_fast_close', type: 'select', options: BOOL_OPTIONS },
      { key: 'server_round_robin', label: 'server_round_robin', type: 'select', options: BOOL_OPTIONS },
    ],
  },
  {
    title: 'Logging',
    params: [
      { key: 'log_connections', label: 'log_connections', type: 'select', options: BOOL_OPTIONS },
      { key: 'log_disconnections', label: 'log_disconnections', type: 'select', options: BOOL_OPTIONS },
      { key: 'log_pooler_errors', label: 'log_pooler_errors', type: 'select', options: BOOL_OPTIONS },
      {
        key: 'log_stats',
        label: 'log_stats',
        type: 'select',
        options: BOOL_OPTIONS,
        hint: 'Default: 0 — stats are collected via Prometheus exporter.',
      },
      { key: 'stats_period', label: 'stats_period', type: 'number', placeholder: 'seconds' },
      { key: 'verbose', label: 'verbose', type: 'number', placeholder: '0' },
    ],
  },
  {
    title: 'Startup & Misc',
    params: [
      {
        key: 'ignore_startup_parameters',
        label: 'ignore_startup_parameters',
        type: 'text',
        placeholder: 'extra_float_digits,options',
        hint: 'Required by CNP: extra_float_digits,options must be present.',
      },
      { key: 'application_name_add_host', label: 'application_name_add_host', type: 'select', options: BOOL_OPTIONS },
      { key: 'disable_pqexec', label: 'disable_pqexec', type: 'select', options: BOOL_OPTIONS },
    ],
  },
  {
    title: 'TCP Keep-Alive',
    params: [
      { key: 'tcp_keepalive', label: 'tcp_keepalive', type: 'select', options: BOOL_OPTIONS },
      { key: 'tcp_keepidle', label: 'tcp_keepidle', type: 'number', placeholder: 'seconds' },
      { key: 'tcp_keepintvl', label: 'tcp_keepintvl', type: 'number', placeholder: 'seconds' },
      { key: 'tcp_keepcnt', label: 'tcp_keepcnt', type: 'number', placeholder: 'count' },
      { key: 'tcp_user_timeout', label: 'tcp_user_timeout', type: 'number', placeholder: 'ms' },
    ],
  },
];

// ---------- sub-component: single param row ----------
function ParamField({
  def,
  value,
  onChange,
}: {
  def: ParamDef;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const base =
    'w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
        {def.label}
      </label>
      {def.type === 'select' ? (
        <select className={base} value={value ?? ''} onChange={e => onChange(e.target.value)}>
          {def.options!.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={def.type === 'number' ? 'number' : 'text'}
          className={base}
          placeholder={def.placeholder ?? ''}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      )}
      {def.hint && (
        <p className="mt-1 text-[10px] text-amber-500 dark:text-amber-400">{def.hint}</p>
      )}
    </div>
  );
}

// ---------- sub-component: accordion group ----------
function ParamGroup({
  title,
  params,
  pgbouncerParams,
  onParamChange,
}: {
  title: string;
  params: ParamDef[];
  pgbouncerParams: PoolerConfig['pgbouncerParams'];
  onParamChange: (key: keyof PoolerConfig['pgbouncerParams'], value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
      >
        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-widest">
          {title}
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        )}
      </button>
      {open && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {params.map(def => (
            <ParamField
              key={def.key}
              def={def}
              value={(pgbouncerParams as any)[def.key]}
              onChange={v => onParamChange(def.key, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- main component ----------
export default function Step5Pooler({ formData, setFormData }: Props) {
  const addPooler = () => {
    setFormData({
      ...formData,
      poolers: [...formData.poolers, defaultPooler()],
    });
  };

  const removePooler = (idx: number) => {
    setFormData({
      ...formData,
      poolers: formData.poolers.filter((_, i) => i !== idx),
    });
  };

  const updatePooler = (idx: number, field: keyof PoolerConfig, value: any) => {
    const newPoolers = [...formData.poolers];
    (newPoolers[idx] as any)[field] = value;
    setFormData({ ...formData, poolers: newPoolers });
  };

  const updateParam = (
    idx: number,
    key: keyof PoolerConfig['pgbouncerParams'],
    value: string
  ) => {
    const newPoolers = [...formData.poolers];
    const current = { ...(newPoolers[idx].pgbouncerParams ?? {}) };
    if (value === '') {
      delete (current as any)[key];
    } else {
      (current as any)[key] = value;
    }
    newPoolers[idx] = { ...newPoolers[idx], pgbouncerParams: current };
    setFormData({ ...formData, poolers: newPoolers });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold dark:text-white font-outfit">Connection Poolers</h2>
          <p className="text-sm text-gray-500">
            Add one or more PgBouncer poolers. Parameters are written to{' '}
            <code className="text-indigo-500 text-xs">.spec.pgbouncer.parameters</code>.
          </p>
        </div>
        <button
          onClick={addPooler}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
        >
          <Layers className="w-4 h-4 mr-2" /> ADD POOLER
        </button>
      </div>

      {/* Pooler cards */}
      <div className="space-y-6">
        {formData.poolers.map((pooler, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm relative group"
          >
            {/* Badge */}
            <div className="absolute -top-3 left-6 px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full shadow-md uppercase">
              Pooler #{idx + 1}: {pooler.type}
            </div>

            {/* Remove button */}
            <button
              onClick={() => removePooler(idx)}
              className="absolute top-4 right-4 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Base fields */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 mb-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Type
                </label>
                <select
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  value={pooler.type}
                  onChange={e => updatePooler(idx, 'type', e.target.value)}
                >
                  <option value="rw">Read-Write (rw)</option>
                  <option value="ro">Read-Only (ro)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Instances
                </label>
                <input
                  type="number"
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  value={pooler.instances}
                  onChange={e => updatePooler(idx, 'instances', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Max Connections
                </label>
                <input
                  type="number"
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  value={pooler.maxConnections}
                  onChange={e => updatePooler(idx, 'maxConnections', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Pool Mode
                </label>
                <select
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  value={pooler.poolMode}
                  onChange={e => updatePooler(idx, 'poolMode', e.target.value)}
                >
                  <option value="session">Session</option>
                  <option value="transaction">Transaction</option>
                </select>
              </div>
            </div>

            {/* PgBouncer Parameters accordion */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">
                  PgBouncer Parameters
                </span>
              </div>
              {PARAM_GROUPS.map(group => (
                <ParamGroup
                  key={group.title}
                  title={group.title}
                  params={group.params}
                  pgbouncerParams={pooler.pgbouncerParams ?? {}}
                  onParamChange={(key, value) => updateParam(idx, key, value)}
                />
              ))}
            </div>
          </div>
        ))}

        {formData.poolers.length === 0 && (
          <div className="p-12 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-3xl text-center">
            <Layers className="w-12 h-12 text-gray-200 dark:text-slate-700 mx-auto mb-4" />
            <p className="text-sm text-gray-400">
              No connection poolers enabled. Click the button above to add one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
