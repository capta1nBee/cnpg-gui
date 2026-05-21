CREATE TABLE active_alerts (
    id UUID PRIMARY KEY,
    rule_id UUID,
    tenant_id UUID,
    cluster_name VARCHAR(255),
    metric_type VARCHAR(50),
    comparison VARCHAR(20),
    threshold DOUBLE PRECISION,
    current_value DOUBLE PRECISION,
    status VARCHAR(20) DEFAULT 'OPEN',
    severity VARCHAR(20),
    opened_at TIMESTAMP,
    closed_at TIMESTAMP,
    last_evaluated_at TIMESTAMP,
    open_notified BOOLEAN DEFAULT FALSE,
    close_notified BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_active_alerts_tenant ON active_alerts(tenant_id);
CREATE INDEX idx_active_alerts_status ON active_alerts(status);
CREATE INDEX idx_active_alerts_cluster ON active_alerts(cluster_name);
