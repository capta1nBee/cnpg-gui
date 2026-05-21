CREATE TABLE ldap_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled BOOLEAN DEFAULT false,
    url VARCHAR(512),
    bind_dn VARCHAR(512),
    bind_password VARCHAR(512),
    base_dn VARCHAR(512),
    user_filter VARCHAR(256),
    username_attribute VARCHAR(64),
    email_attribute VARCHAR(64),
    group_mapping JSONB,
    sync_interval_minutes INTEGER DEFAULT 60,
    tls_enabled BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT NOW()
);
