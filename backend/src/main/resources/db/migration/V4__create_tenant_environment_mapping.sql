CREATE TABLE tenant_environment_mapping (
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    environment_id UUID REFERENCES k8s_environments(id) ON DELETE CASCADE,
    PRIMARY KEY (tenant_id, environment_id)
);
