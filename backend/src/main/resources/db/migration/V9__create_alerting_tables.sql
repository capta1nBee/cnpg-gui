CREATE TABLE alert_rules (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    cluster_name VARCHAR(255),
    metric_type VARCHAR(50) NOT NULL, -- CPU, MEMORY, STORAGE, BACKUP_FAILURE
    threshold FLOAT NOT NULL,
    comparison VARCHAR(10) DEFAULT '>',
    duration_minutes INT DEFAULT 5,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_channels (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    channel_type VARCHAR(50) NOT NULL, -- SLACK, EMAIL, WEBHOOK
    target_config TEXT NOT NULL, -- JSON config (webhook url, email address etc)
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
