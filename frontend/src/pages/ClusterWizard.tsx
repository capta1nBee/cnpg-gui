import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Server, Database, Network, Shield, Settings, CheckCircle, ArrowRight, ArrowLeft, Layers, Lock, Cpu, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import { useTenant } from '../context/TenantContext';
import { useUI } from '../context/UIContext';

// Import Types
import type { WizardFormData } from './wizard-steps/types';

// Import Steps
import Step1General from './wizard-steps/Step1General';
import Step2Compute from './wizard-steps/Step2Compute';
import Step3Replication from './wizard-steps/Step3Replication';
import Step4Scheduling from './wizard-steps/Step4Scheduling';
import Step5Pooler from './wizard-steps/Step5Pooler';
import Step6Config from './wizard-steps/Step6Config';
import Step7Backup from './wizard-steps/Step7Backup';
import Step8PITR from './wizard-steps/Step8PITR';
import Step9Security from './wizard-steps/Step9Security';
import Step10Review from './wizard-steps/Step10Review';

// Shared Utilities
import { isValidK8sName } from './wizard-steps/shared';

export default function ClusterWizard() {
  const { activeEnvironmentId } = useTenant();
  const { toast } = useUI();
  const navigate = useNavigate();
  const { namespace, name } = useParams();
  const isEditMode = !!(namespace && name);

  const FIXED_PARAMETERS = [
    'archive_command', 'archive_mode', 'full_page_writes', 'hot_standby',
    'listen_addresses', 'port', 'restart_after_crash', 'ssl',
    'ssl_ca_file', 'ssl_cert_file', 'ssl_key_file',
    'unix_socket_directories', 'wal_level', 'wal_log_hints', 'log_rotation_size',
    'log_rotation_age', 'log_truncate_on_rotation', 'logging_collector', 'log_destination', 'log_directory', 'log_filename'
  ];

  const FIXED_PARAMETER_VALUES: Record<string, string> = {
    'archive_command': '/controller/manager wal-archive %p',
    'archive_mode': 'on',
    'full_page_writes': 'on',
    'hot_standby': 'true',
    'listen_addresses': '*',
    'port': '5432',
    'restart_after_crash': 'false',
    'ssl': 'on',
    'ssl_ca_file': '/controller/certificates/client-ca.crt',
    'ssl_cert_file': '/controller/certificates/server.crt',
    'ssl_key_file': '/controller/certificates/server.key',
    'unix_socket_directories': '/controller/run',
    'wal_level': 'logical',
    'wal_log_hints': 'on',
    'log_rotation_size': 'Managed by Operator',
    'log_rotation_age': 'Managed by Operator',
    'log_truncate_on_rotation': 'Managed by Operator',
    'logging_collector': 'Managed by Operator',
    'log_destination': 'Managed by Operator',
    'log_directory': 'Managed by Operator',
    'log_filename': 'Managed by Operator'
  };

  const [step, setStep] = useState(1);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [storageClasses, setStorageClasses] = useState<string[]>([]);
  const [availableClusters, setAvailableClusters] = useState<any[]>([]);
  const [isTestingS3, setIsTestingS3] = useState(false);
  const [s3TestResult, setS3TestResult] = useState<{ success: boolean, message: string } | null>(null);

  const [formData, setFormData] = useState<WizardFormData>({
    name: '', namespace: '',
    pgVersion: '16', dbName: 'app', storageSize: '10Gi', memoryLimit: '2Gi', cpuLimit: '1', storageClass: '',
    instances: 3, replicationMode: 'sync', syncReplication: false, failoverEnable: true,
    poolers: [],
    adminUsername: 'appuser', adminPassword: '', confirmPassword: '', secretManagement: 'kubernetes',
    extensions: '', maintenanceMode: false,
    labels: [{ key: 'app', value: 'database' }],
    shmLimit: '1Gi',
    enablePodAntiAffinity: true,
    topologyKey: 'kubernetes.io/hostname',
    antiAffinityType: 'preferred',
    nodeSelector: [{ key: '', value: '' }],
    tolerations: [{ key: '', operator: 'Exists', effect: 'NoSchedule' }],
    tablespaces: [],
    backupEnabled: false,
    backupMethod: 'barmanObjectStore',
    backupTarget: 'prefer-standby',
    backupImmediate: false,
    backupOwnerReference: 'cluster',
    backupSchedule: '0 0 * * *',
    replicaEnabled: false,
    replicaSource: '',
    externalClusters: [],
    pgParameters: [
      { key: 'archive_timeout', value: '5min' },
      { key: 'dynamic_shared_memory_type', value: 'posix' },
      { key: 'log_destination', value: 'csvlog' },
      { key: 'log_directory', value: '/controller/log' },
      { key: 'log_filename', value: 'postgres' },
      { key: 'log_rotation_age', value: '0' },
      { key: 'log_rotation_size', value: '0' },
      { key: 'log_truncate_on_rotation', value: 'false' },
      { key: 'logging_collector', value: 'on' },
      { key: 'max_parallel_workers', value: '32' },
      { key: 'max_replication_slots', value: '32' },
      { key: 'max_worker_processes', value: '32' },
      { key: 'shared_memory_type', value: 'mmap' },
      { key: 'shared_preload_libraries', value: '' },
      { key: 'ssl_max_protocol_version', value: 'TLSv1.3' },
      { key: 'ssl_min_protocol_version', value: 'TLSv1.3' },
      { key: 'wal_keep_size', value: '512MB' },
      { key: 'wal_receiver_timeout', value: '5s' },
      { key: 'wal_sender_timeout', value: '5s' }
    ],
    pgHba: [],
    pgIdent: [],
    enableAlterSystem: true,
    enableSuperuserAccess: true,
    managedRoles: [],
    endpointUrl: 'http://minio.poyrazk8s.com',
    bucketName: 'poyraz-backups',
    s3AccessKey: 'S3ACCESSKEY',
    s3SecretKey: 'S3SECRETKEY',
    skipVerify: true,
    retentionPolicy: '7d',
    pitrEnabled: true,
    walRetentionDays: 30
  });

  const [isYamlMode, setIsYamlMode] = useState(false);
  const [yamlContent, setYamlContent] = useState('');

  useEffect(() => {
    if (activeEnvironmentId) {
      fetchLists();
      if (isEditMode) {
        fetchClusterDetails();
      }
    }
  }, [activeEnvironmentId, isEditMode, namespace, name]);

  const fetchClusterDetails = async () => {
    try {
      const [clusterRes, s3Res, bootRes, poolRes, userRes] = await Promise.all([
        api.get(`/clusters/${namespace}/${name}`),
        api.get(`/clusters/${namespace}/${name}/s3-credentials`).catch(() => ({ data: {} })),
        api.get(`/clusters/${namespace}/${name}/bootstrap-credentials`).catch(() => ({ data: {} })),
        api.get(`/clusters/${namespace}/${name}/pooler`).catch(() => ({ data: { enabled: false } })),
        api.get(`/clusters/${namespace}/${name}/users-roles`).catch(() => ({ data: { managedRoles: [] } }))
      ]);

      const cluster = clusterRes.data;
      const spec = cluster.spec || {};
      const backup = spec.backup || {};
      const barman = backup.barmanObjectStore || {};
      const pg = spec.postgresql || {};
      const affinity = spec.affinity || {};
      const limits = spec.resources?.limits || {};

      const managedRolesFromSpec = spec.managed?.roles || [];
      const enrichedRoles = userRes.data.managedRoles || [];

      const mappedRoles = managedRolesFromSpec.map((r: any) => {
        const enriched = enrichedRoles.find((er: any) => er.name === r.name) || {};
        return {
          name: r.name || '',
          ensure: r.ensure || 'present',
          login: r.login ?? true,
          superuser: r.superuser ?? false,
          createdb: r.createdb ?? false,
          createrole: r.createrole ?? false,
          inherit: r.inherit ?? true,
          replication: r.replication ?? false,
          bypassrls: r.bypassrls ?? false,
          connectionLimit: r.connectionLimit ?? -1,
          comment: r.comment || '',
          disablePassword: r.disablePassword ?? false,
          passwordSecret: r.passwordSecret?.name || '',
          password: enriched.password || '',
          validUntil: r.validUntil || '',
          inRoles: r.inRoles || [],
        };
      });

      setFormData(prev => ({
        ...prev,
        name: cluster.name,
        namespace: cluster.namespace,
        pgVersion: spec.imageName ? spec.imageName.split(':')[1] : prev.pgVersion,
        instances: spec.instances || prev.instances,
        storageSize: spec.storage?.size || spec.storage?.pvcTemplate?.spec?.resources?.requests?.storage || prev.storageSize,
        storageClass: spec.storage?.storageClass || spec.storage?.pvcTemplate?.storageClassName || prev.storageClass,
        cpuLimit: limits.cpu || prev.cpuLimit,
        memoryLimit: limits.memory || prev.memoryLimit,
        dbName: spec.bootstrap?.initdb?.database || prev.dbName,
        shmLimit: spec.ephemeralVolumesSizeLimit?.shm || prev.shmLimit,
        backupEnabled: !!spec.backup,
        backupMethod: barman.destinationPath ? 'barmanObjectStore' : 'volumeSnapshot',
        bucketName: barman.destinationPath ? barman.destinationPath.replace('s3://', '').replace('/', '') : prev.bucketName,
        endpointUrl: barman.endpointURL || prev.endpointUrl,
        backupTarget: backup.target || prev.backupTarget,
        retentionPolicy: barman.retentionPolicy || prev.retentionPolicy,
        skipVerify: barman.verifySSL === false,
        pitrEnabled: !!backup.wal,
        s3AccessKey: s3Res.data.accessKeyId || prev.s3AccessKey,
        s3SecretKey: s3Res.data.secretAccessKey || prev.s3SecretKey,
        adminUsername: bootRes.data.username || prev.adminUsername,
        adminPassword: bootRes.data.password || prev.adminPassword,
        confirmPassword: bootRes.data.password || prev.adminPassword,
        poolers: poolRes.data.enabled ? [{
          type: (poolRes.data.type as 'rw' | 'ro') || 'rw',
          instances: poolRes.data.instances || 2,
          poolMode: (poolRes.data.poolMode as 'session' | 'transaction') || 'session',
          maxConnections: parseInt(poolRes.data.maxConnections || '100'),
          pgbouncerParams: {
            ignore_startup_parameters: 'extra_float_digits,options',
            log_stats: '0',
            ...(poolRes.data.pgbouncerParams || {})
          }
        }] : [],
        failoverEnable: spec.failoverDelay === 0,
        enablePodAntiAffinity: !!affinity.enablePodAntiAffinity,
        managedRoles: mappedRoles,
        pgHba: pg.pg_hba || prev.pgHba,
        pgIdent: pg.pg_ident || prev.pgIdent,
        pgParameters: Object.entries(pg.parameters || {})
          .filter(([key]) => !FIXED_PARAMETERS.includes(key))
          .map(([key, value]) => ({ key, value: String(value) })),
        syncReplication: !!pg.synchronous,
        enableAlterSystem: pg.enableAlterSystem ?? prev.enableAlterSystem,
        enableSuperuserAccess: spec.enableSuperuserAccess ?? prev.enableSuperuserAccess,
        tablespaces: spec.tablespaces?.map((t: any) => ({
          name: t.name,
          size: t.storage?.size,
          storageClass: t.storage?.storageClassName || prev.storageClass,
          temporary: !!t.temporary,
          owner: t.owner?.name || ''
        })) || prev.tablespaces,
        replicaEnabled: !!spec.replica?.enabled,
        replicaSource: spec.replica?.source || prev.replicaSource,
        externalClusters: spec.externalClusters?.map((e: any) => ({
          name: e.name,
          host: e.connectionParameters?.host || '',
          user: e.connectionParameters?.user || 'postgres',
          dbname: e.connectionParameters?.dbname || 'postgres',
          method: e.connectionParameters ? 'streaming' : 'barman'
        })) || prev.externalClusters,
        topologyKey: affinity.topologyKey || prev.topologyKey,
        antiAffinityType: affinity.podAntiAffinityType || prev.antiAffinityType,
        nodeSelector: Object.entries(affinity.nodeSelector || {}).map(([key, value]) => ({ key, value: String(value) })),
        tolerations: affinity.tolerations || prev.tolerations
      }));
    } catch (err) {
      console.error('Failed to fetch cluster details', err);
      toast('Failed to load cluster details', 'error');
    }
  };

  const fetchLists = async () => {
    try {
      const [nsRes, scRes, clusterRes] = await Promise.all([
        api.get('/k8s/namespaces'),
        api.get('/k8s/storage-classes'),
        api.get('/clusters')
      ]);
      setNamespaces(nsRes.data);
      setStorageClasses(scRes.data);
      setAvailableClusters(clusterRes.data || []);

      setFormData(prev => ({
        ...prev,
        namespace: prev.namespace || (nsRes.data.includes('default') ? 'default' : nsRes.data[0] || ''),
        storageClass: prev.storageClass || scRes.data[0] || 'standard'
      }));
    } catch (err) {
      console.error('Failed to fetch K8S lists', err);
    }
  };

  const testS3 = async () => {
    try {
      setIsTestingS3(true);
      setS3TestResult(null);
      const res = await api.post('/backups/test-s3', {
        endpointUrl: formData.endpointUrl,
        bucketName: formData.bucketName,
        accessKey: formData.s3AccessKey,
        secretKey: formData.s3SecretKey,
        skipVerify: formData.skipVerify
      }, {
        headers: {
          'X-Namespace': formData.namespace || 'default'
        }
      });
      
      if (res.data?.success) {
        setS3TestResult({ success: true, message: res.data.message || 'Connection successful' });
      } else {
        setS3TestResult({ success: false, message: res.data?.message || 'Connection failed' });
      }
    } catch (err) {
      setS3TestResult({ success: false, message: 'Connection failed: API Error' });
    } finally {
      setIsTestingS3(false);
    }
  };

  const steps = [
    { id: 1, title: 'General', icon: Server },
    { id: 2, title: 'Compute', icon: Cpu },
    { id: 3, title: 'Replication', icon: Database },
    { id: 4, title: 'Scheduling', icon: Network },
    { id: 5, title: 'Pooler', icon: Layers },
    { id: 6, title: 'Config', icon: Settings },
    { id: 7, title: 'Backup', icon: Shield },
    { id: 8, title: 'PITR', icon: RefreshCw },
    { id: 9, title: 'Security', icon: Lock },
    { id: 10, title: 'Review', icon: CheckCircle },
  ];

  const generateYamlString = () => {
    const annotationsLines = formData.maintenanceMode ? '    cnpg.io/reconciliationPaused: "true"' : '';
    const labelsLines = formData.labels.filter(l => l.key && l.value).map(l => `${l.key}: "${l.value}"`).join('\n    ');
    const allParametersLines = formData.pgParameters
      .filter(p => p.key && !FIXED_PARAMETERS.includes(p.key))
      .map(p => `${p.key}: "${p.value}"`)
      .join('\n      ');

    let yaml = `apiVersion: v1
kind: Secret
metadata:
  name: ${formData.name}-user-auth
  namespace: ${formData.namespace}
  labels:
    cnpg.io/cluster: ${formData.name}
type: kubernetes.io/basic-auth
stringData:
  username: ${formData.adminUsername}
  password: ${formData.adminPassword}
---
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: ${formData.name}
  namespace: ${formData.namespace}${annotationsLines ? `\n  annotations:\n${annotationsLines}` : ''}${labelsLines ? `\n  labels:\n    ${labelsLines}` : ''}
spec:
  enableSuperuserAccess: ${formData.enableSuperuserAccess}
  instances: ${formData.instances}
  imageName: ghcr.io/cloudnative-pg/postgresql:${formData.pgVersion}
  storage:
    size: "${formData.storageSize}"
    pvcTemplate:
      accessModes:
        - ReadWriteOnce
      storageClassName: "${formData.storageClass || 'standard'}"
  failoverDelay: ${formData.failoverEnable ? 0 : 300}
  resources:
    limits:
      cpu: "${formData.cpuLimit}"
      memory: "${formData.memoryLimit}"
  ${formData.shmLimit ? `ephemeralVolumesSizeLimit:
    shm: "${formData.shmLimit}"` : ''}
  ${formData.replicaEnabled ? `replica:
    enabled: true
    source: "${formData.replicaSource}"` : ''}
  bootstrap:
    initdb:
      database: ${formData.dbName || 'app'}
      owner: ${formData.adminUsername}
      secret:
        name: ${formData.name}-user-auth
  postgresql:
    ${formData.enableAlterSystem ? 'enableAlterSystem: true' : 'enableAlterSystem: false'}
    ${formData.replicationMode === 'sync' ? `synchronous:
      method: first
      number: 1
    syncReplicaElectionConstraint:
      enabled: true
      nodeLabelsAntiAffinity:
        - kubernetes.io/hostname` : ''}
    ${formData.pgIdent.length > 0 ? `pg_ident:
      - ${formData.pgIdent.filter(i => i.trim()).join('\n      - ')}` : ''}
    ${formData.extensions ? `extensions:
      - ${formData.extensions.split(',').map(e => e.trim()).join('\n      - ')}` : ''}
    parameters:
      ${allParametersLines}
    ${formData.pgHba.length > 0 ? `pg_hba:
      - ${formData.pgHba.filter(h => h.trim()).join('\n      - ')}` : ''}
  ${formData.backupEnabled ? `backup:
    barmanObjectStore:
      destinationPath: s3://${formData.bucketName}/
      endpointURL: ${formData.endpointUrl}
      s3Credentials:
        accessKeyId:
          name: ${formData.name}-s3-creds
          key: ACCESS_KEY_ID
        secretAccessKey:
          name: ${formData.name}-s3-creds
          key: SECRET_ACCESS_KEY
      ${formData.endpointUrl.startsWith('https://') ? (formData.skipVerify ? 'verifySSL: false' : 'verifySSL: true') : 'verifySSL: false'}
      retentionPolicy: "${formData.retentionPolicy}"
    target: "${formData.backupTarget}"
    ${formData.pitrEnabled ? `wal:
        compression: gzip
        maxParallel: 8` : ''}` : ''}
  affinity:
    enablePodAntiAffinity: ${formData.enablePodAntiAffinity}
    podAntiAffinityType: ${formData.antiAffinityType}
    topologyKey: ${formData.topologyKey}
  ${formData.nodeSelector.some(ns => ns.key) ? `nodeSelector:
    ${formData.nodeSelector.filter(ns => ns.key).map(ns => `${ns.key}: "${ns.value}"`).join('\n    ')}` : ''}
  ${formData.tolerations.some(t => t.key) ? `tolerations:
    ${formData.tolerations.filter(t => t.key).map(t => `- key: "${t.key}"\n      operator: "${t.operator}"\n      effect: "${t.effect}"`).join('\n    ')}` : ''}
  ${formData.tablespaces.length > 0 ? `tablespaces:
    ${formData.tablespaces.map(ts => `- name: ${ts.name}\n      storage:\n        size: "${ts.size}"\n        ${ts.storageClass ? `storageClassName: "${ts.storageClass}"` : ''}\n      ${ts.temporary ? 'temporary: true' : ''}${ts.owner ? `\n      owner:\n        name: "${ts.owner}"` : ''}`).join('\n    ')}` : ''}
  ${formData.managedRoles.length > 0 ? `managed:
    roles:
      ${formData.managedRoles.map(r => `- name: "${r.name}"
        ensure: "${r.ensure}"
        login: ${r.login}
        superuser: ${r.superuser}
        ${r.createdb ? `createdb: ${r.createdb}` : ''}
        ${r.createrole ? `createrole: ${r.createrole}` : ''}
        ${r.inherit !== undefined ? `inherit: ${r.inherit}` : ''}
        ${r.replication ? `replication: ${r.replication}` : ''}
        ${r.bypassrls ? `bypassrls: ${r.bypassrls}` : ''}
        ${r.connectionLimit !== undefined ? `connectionLimit: ${r.connectionLimit}` : ''}
        ${r.comment ? `comment: "${r.comment}"` : ''}
        ${r.validUntil ? `validUntil: "${new Date(r.validUntil).toISOString()}"` : ''}
        ${r.passwordSecret ? `passwordSecret:\n          name: "${r.passwordSecret}"` : ''}
        ${r.inRoles && r.inRoles.length > 0 ? `inRoles:\n          ${r.inRoles.map(ir => `- "${ir}"`).join('\n          ')}` : ''}`).join('\n      ')}` : ''}
  ${formData.externalClusters.length > 0 ? `externalClusters:
    ${formData.externalClusters.map(ec => `- name: "${ec.name}"
      ${ec.method === 'streaming' ? `connectionParameters:
        host: "${ec.host}"
        user: "${ec.user}"
        dbname: "${ec.dbname}"` : `plugin:
        name: barman-cloud.cloudnative-pg.io
        parameters:
          barmanObjectName: "${ec.name}"
          serverName: "${ec.name}"`}`).join('\n    ')}` : ''}`;

    formData.poolers.forEach((p, idx) => {
      const extraParams = Object.entries(p.pgbouncerParams || {})
        .filter(([k, v]) => k !== 'max_client_conn' && v !== '' && v !== undefined)
        .map(([k, v]) => `      ${k}: "${v}"`)
        .join('\n');
      yaml += `
---
apiVersion: postgresql.cnpg.io/v1
kind: Pooler
metadata:
  name: ${formData.name}-pooler-${p.type}-${idx}
  namespace: ${formData.namespace}
spec:
  cluster:
    name: ${formData.name}
  instances: ${p.instances}
  type: ${p.type}
  pgbouncer:
    poolMode: ${p.poolMode}
    parameters:
      max_client_conn: "${p.maxConnections}"${extraParams ? '\n' + extraParams : ''}`;
    });

    return yaml.trim();
  };

  const generateScheduledBackupYaml = () => {
    return `apiVersion: postgresql.cnpg.io/v1
kind: ScheduledBackup
metadata:
  name: ${formData.name}-scheduled-backup
  namespace: ${formData.namespace}
spec:
  schedule: "${formData.backupSchedule}"
  backupOwnerReference: ${formData.backupOwnerReference}
  immediate: ${formData.backupImmediate}
  method: ${formData.backupMethod}
  cluster:
    name: ${formData.name}`.trim();
  };

  const generateS3SecretYaml = () => {
    return `apiVersion: v1
kind: Secret
metadata:
  name: ${formData.name}-s3-creds
  namespace: ${formData.namespace}
  labels:
    cnpg.io/cluster: ${formData.name}
type: Opaque
data:
  ACCESS_KEY_ID: ${btoa(formData.s3AccessKey)}
  SECRET_ACCESS_KEY: ${btoa(formData.s3SecretKey)}`.trim();
  };

  const generateManagedRoleSecretYaml = (role: any) => {
    return `apiVersion: v1
kind: Secret
metadata:
  name: ${role.passwordSecret}
  namespace: ${formData.namespace}
  labels:
    cnpg.io/cluster: ${formData.name}
type: kubernetes.io/basic-auth
stringData:
  username: "${role.name}"
  password: "${role.password}"`.trim();
  };

  const generateYaml = () => {
    let yaml = generateYamlString();
    if (formData.backupEnabled) {
      yaml += `\n---\n${generateS3SecretYaml()}`;
      yaml += `\n---\n${generateScheduledBackupYaml()}`;
    }
    formData.managedRoles.forEach(role => {
      if (role.password && role.passwordSecret) {
        yaml += `\n---\n${generateManagedRoleSecretYaml(role)}`;
      }
    });
    setYamlContent(yaml);
    return yaml;
  };

  const handleNext = () => {
    if (step === 9) generateYaml();
    setStep((prev) => Math.min(prev + 1, 10));
  };
  const handlePrev = () => setStep((prev) => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    if (!formData.name) { toast('Cluster name is required', 'error'); return; }
    if (!isValidK8sName(formData.name)) { toast('Cluster name must be a valid Kubernetes object name', 'error'); return; }
    if (!formData.storageSize) { toast('Storage size is required', 'error'); return; }

    try {
      const yaml = isYamlMode ? yamlContent : generateYaml();
      const base64Yaml = btoa(unescape(encodeURIComponent(yaml)));

      await api.post('/clusters', base64Yaml, {
        headers: {
          'X-Namespace': formData.namespace,
          'Content-Type': 'text/plain'
        }
      });

      toast(isEditMode ? 'Cluster update request sent successfully!' : 'Cluster creation request sent successfully!', 'success');
      navigate('/clusters');
    } catch (err: any) {
      toast('Failed to create cluster: ' + (err.response?.data?.error?.message || err.response?.data?.message || err.message), 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto bg-white dark:bg-[#0B1120] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      {/* Premium Wizard Header */}
      <div className="bg-gray-50 dark:bg-gray-900/50 p-6 flex justify-between border-b border-gray-100 dark:border-gray-800 overflow-x-auto custom-scrollbar">
        {steps.map((s) => (
          <div key={s.id} className={`flex flex-col items-center min-w-[80px] transition-all duration-300 ${step >= s.id ? 'opacity-100' : 'opacity-40'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border-2 ${step === s.id
              ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20'
              : step > s.id ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-400'}`}>
              {step > s.id ? <CheckCircle className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${step === s.id ? 'text-blue-600' : 'text-gray-500'}`}>{s.title}</span>
          </div>
        ))}
      </div>

      <div className="p-10 min-h-[500px]">
        {step === 1 && <Step1General formData={formData} setFormData={setFormData} namespaces={namespaces} availableClusters={availableClusters} isEditMode={isEditMode} name={name} namespace={namespace} />}
        {step === 2 && <Step2Compute formData={formData} setFormData={setFormData} storageClasses={storageClasses} />}
        {step === 3 && <Step3Replication formData={formData} setFormData={setFormData} />}
        {step === 4 && <Step4Scheduling formData={formData} setFormData={setFormData} />}
        {step === 5 && <Step5Pooler formData={formData} setFormData={setFormData} />}
        {step === 6 && <Step6Config formData={formData} setFormData={setFormData} fixedParameters={FIXED_PARAMETER_VALUES} />}
        {step === 7 && <Step7Backup formData={formData} setFormData={setFormData} testS3={testS3} isTestingS3={isTestingS3} s3TestResult={s3TestResult} />}
        {step === 8 && <Step8PITR formData={formData} setFormData={setFormData} />}
        {step === 9 && <Step9Security formData={formData} setFormData={setFormData} />}
        {step === 10 && <Step10Review formData={formData} isYamlMode={isYamlMode} setIsYamlMode={setIsYamlMode} yamlContent={yamlContent} setYamlContent={setYamlContent} generateYaml={generateYaml} />}
      </div>

      {/* Premium Wizard Footer */}
      <div className="bg-gray-50 dark:bg-gray-900/50 p-8 flex justify-between border-t border-gray-100 dark:border-gray-800">
        <button onClick={handlePrev} disabled={step === 1} className="flex items-center px-6 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-30 transition-all hover:bg-gray-50">
          <ArrowLeft className="w-4 h-4 mr-2" /> Previous
        </button>
        {step < 10 ? (
          <button onClick={handleNext} className="flex items-center px-8 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95">
            Continue <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        ) : (
          <button onClick={handleSubmit} className="flex items-center px-10 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95">
            Launch Cluster
          </button>
        )}
      </div>
    </div>
  );
}
