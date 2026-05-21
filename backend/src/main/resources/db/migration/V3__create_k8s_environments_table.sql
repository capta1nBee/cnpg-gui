CREATE TABLE k8s_environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    kubeconfig TEXT NOT NULL,
    api_server_url VARCHAR(512),
    status VARCHAR(20) DEFAULT 'active',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
