CREATE TABLE email_settings (
    id UUID PRIMARY KEY,
    enabled BOOLEAN DEFAULT FALSE,
    host VARCHAR(255),
    port INTEGER DEFAULT 587,
    username VARCHAR(255),
    password VARCHAR(255),
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    encryption_type VARCHAR(50) DEFAULT 'STARTTLS',
    auth_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
