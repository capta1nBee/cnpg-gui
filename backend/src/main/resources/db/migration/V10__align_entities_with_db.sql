-- Align audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS username VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT NOW();

-- Align ldap_settings
ALTER TABLE ldap_settings ADD COLUMN IF NOT EXISTS group_filter VARCHAR(256);
ALTER TABLE ldap_settings ADD COLUMN IF NOT EXISTS admin_group VARCHAR(512);
ALTER TABLE ldap_settings ADD COLUMN IF NOT EXISTS operator_group VARCHAR(512);
ALTER TABLE ldap_settings ADD COLUMN IF NOT EXISTS viewer_group VARCHAR(512);

-- Align query_history
ALTER TABLE query_history ADD COLUMN IF NOT EXISTS username VARCHAR(255);
ALTER TABLE query_history ADD COLUMN IF NOT EXISTS namespace VARCHAR(255);
ALTER TABLE query_history ADD COLUMN IF NOT EXISTS status VARCHAR(20);
ALTER TABLE query_history ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT NOW();

-- Align alert_rules & notification_channels (Ensure gen_random_uuid default)
ALTER TABLE alert_rules ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE notification_channels ALTER COLUMN id SET DEFAULT gen_random_uuid();
