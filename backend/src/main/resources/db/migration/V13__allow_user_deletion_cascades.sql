-- Update audit_logs and query_history to allow user deletion
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE query_history DROP CONSTRAINT IF EXISTS query_history_user_id_fkey;
ALTER TABLE query_history ADD CONSTRAINT query_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
