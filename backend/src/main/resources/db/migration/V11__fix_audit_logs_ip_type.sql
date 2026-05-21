-- ==========================================================
-- V11: FINAL ENTERPRISE SCHEMA SYNC
-- Synchronizes all Database types with Java Domain Entities
-- ==========================================================

-- 1. Fix audit_logs: source_ip (INET -> VARCHAR)
ALTER TABLE audit_logs ALTER COLUMN source_ip TYPE VARCHAR(45);

-- 2. Fix query_history: execution_time_ms (INT -> BIGINT)
ALTER TABLE query_history ALTER COLUMN execution_time_ms TYPE BIGINT;

-- 3. Fix users: role constraint (Case sensitivity fix for Enum mapping)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('SUPERADMIN', 'ADMIN', 'BACKUP_OPERATOR', 'VIEWER', 'superadmin', 'admin', 'backup_operator', 'viewer'));

-- 4. Fix users: auth_type constraint (Support uppercase Enum mapping)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_type_check;
ALTER TABLE users ADD CONSTRAINT users_auth_type_check 
    CHECK (auth_type IN ('LOCAL', 'LDAP', 'local', 'ldap'));

-- 5. Ensure JSONB columns are flexible for Hibernate 6
-- (Existing JSONB columns: audit_logs.old_value, audit_logs.new_value, audit_logs.error_details)
-- No changes needed as they match @JdbcTypeCode(SqlTypes.JSON)

-- 6. Ensure UUID defaults are consistent across all tables
ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE tenants ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE k8s_environments ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE audit_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE query_history ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE ldap_settings ALTER COLUMN id SET DEFAULT gen_random_uuid();
