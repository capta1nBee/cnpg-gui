export interface ManagedRole {
  name: string;
  ensure: 'present' | 'absent';
  login: boolean;
  superuser: boolean;
  createdb: boolean;
  createrole: boolean;
  inherit: boolean;
  replication: boolean;
  bypassrls: boolean;
  connectionLimit: number;
  comment: string;
  disablePassword: boolean;
  passwordSecret: string;
  password?: string;
  validUntil: string;
  inRoles: string[];
}

export interface Tablespace {
  name: string;
  size: string;
  storageClass: string;
  temporary: boolean;
  owner: string;
}

export interface ExternalCluster {
  name: string;
  host: string;
  user: string;
  dbname: string;
  method: 'streaming' | 'barman';
}

export interface KeyValuePair {
  key: string;
  value: string;
}

export interface Toleration {
  key: string;
  operator: string;
  effect: string;
}

export interface PoolerConfig {
  type: 'rw' | 'ro';
  instances: number;
  poolMode: 'session' | 'transaction';
  maxConnections: number;
  // PgBouncer parameters - spec.pgbouncer.parameters
  pgbouncerParams: {
    application_name_add_host?: string;
    autodb_idle_timeout?: string;
    client_idle_timeout?: string;
    client_login_timeout?: string;
    default_pool_size?: string;
    disable_pqexec?: string;
    idle_transaction_timeout?: string;
    ignore_startup_parameters?: string;
    log_connections?: string;
    log_disconnections?: string;
    log_pooler_errors?: string;
    log_stats?: string;
    max_client_conn?: string;
    max_db_connections?: string;
    max_user_connections?: string;
    min_pool_size?: string;
    query_timeout?: string;
    query_wait_timeout?: string;
    reserve_pool_size?: string;
    reserve_pool_timeout?: string;
    server_check_delay?: string;
    server_check_query?: string;
    server_connect_timeout?: string;
    server_fast_close?: string;
    server_idle_timeout?: string;
    server_lifetime?: string;
    server_login_retry?: string;
    server_reset_query?: string;
    server_reset_query_always?: string;
    server_round_robin?: string;
    stats_period?: string;
    tcp_keepalive?: string;
    tcp_keepcnt?: string;
    tcp_keepidle?: string;
    tcp_keepintvl?: string;
    tcp_user_timeout?: string;
    verbose?: string;
  };
}

export interface WizardFormData {
  name: string;
  namespace: string;
  pgVersion: string;
  dbName: string;
  storageSize: string;
  memoryLimit: string;
  cpuLimit: string;
  storageClass: string;
  instances: number;
  replicationMode: 'sync' | 'async';
  syncReplication: boolean;
  failoverEnable: boolean;
  poolers: PoolerConfig[];
  adminUsername: string;
  adminPassword: string;
  confirmPassword: string;
  secretManagement: string;
  extensions: string;
  maintenanceMode: boolean;
  labels: KeyValuePair[];
  shmLimit: string;
  enablePodAntiAffinity: boolean;
  topologyKey: string;
  antiAffinityType: 'preferred' | 'required';
  nodeSelector: KeyValuePair[];
  tolerations: Toleration[];
  tablespaces: Tablespace[];
  backupEnabled: boolean;
  backupMethod: string;
  backupTarget: string;
  backupImmediate: boolean;
  backupOwnerReference: string;
  backupSchedule: string;
  replicaEnabled: boolean;
  replicaSource: string;
  externalClusters: ExternalCluster[];
  pgParameters: KeyValuePair[];
  pgHba: string[];
  pgIdent: string[];
  enableAlterSystem: boolean;
  enableSuperuserAccess: boolean;
  managedRoles: ManagedRole[];
  endpointUrl: string;
  bucketName: string;
  s3AccessKey: string;
  s3SecretKey: string;
  skipVerify: boolean;
  retentionPolicy: string;
  pitrEnabled: boolean;
  walRetentionDays: number;
}
