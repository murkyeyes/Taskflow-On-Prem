-- Development-only bootstrap user. Password: password
INSERT INTO users (name, email, password_hash, account_role)
VALUES (
    'Development Admin',
    'admin@taskflow.local',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',
    'overall_admin'
)
ON CONFLICT (email) DO NOTHING;
