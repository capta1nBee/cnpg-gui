CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_name VARCHAR(255),
    tenant_id UUID,
    environment_id UUID,
    old_value JSONB,
    new_value JSONB,
    source_ip INET,
    user_agent TEXT,
    status VARCHAR(20),
    error_message TEXT,
    error_details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
