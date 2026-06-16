-- Run on droplet as: mysql --defaults-file=/etc/mysql/debian.cnf < setup-db.sql

CREATE TABLE IF NOT EXISTS local_reference.clients (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  company_name  VARCHAR(128) NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sample client — replace password_hash with real bcrypt hash before use.
-- Generate hash: python3 -c "from passlib.hash import bcrypt; print(bcrypt.hash('YourPassword123'))"
INSERT INTO local_reference.clients (email, password_hash, company_name)
VALUES ('client@example.com', '$2b$12$PLACEHOLDER_REPLACE_WITH_REAL_HASH', 'PXP Solutions')
ON DUPLICATE KEY UPDATE company_name = VALUES(company_name);
