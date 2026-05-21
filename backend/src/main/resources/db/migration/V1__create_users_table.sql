CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('local', 'ldap')),
    password_hash VARCHAR(255),
    ldap_dn VARCHAR(512),
    role VARCHAR(50) NOT NULL CHECK (role IN ('superadmin', 'admin', 'backup_operator', 'viewer')),
    tenant_id UUID,
    status VARCHAR(20) DEFAULT 'active',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
