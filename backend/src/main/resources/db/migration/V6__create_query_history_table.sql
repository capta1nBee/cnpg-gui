CREATE TABLE query_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    cluster_name VARCHAR(255),
    environment_id UUID,
    tenant_id UUID,
    query_text TEXT,
    row_count INTEGER,
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
