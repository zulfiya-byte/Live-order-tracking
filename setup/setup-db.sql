-- Run on droplet as: mysql --defaults-file=/etc/mysql/debian.cnf < setup-db.sql

CREATE TABLE IF NOT EXISTS local_reference.clients (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  company_name  VARCHAR(128) NOT NULL,
  is_admin      TINYINT(1)  NOT NULL DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS local_reference.client_contacts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  client_id     INT NOT NULL,
  contact_name  VARCHAR(255) NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_client_contact (client_id, contact_name),
  FOREIGN KEY (client_id) REFERENCES local_reference.clients(id) ON DELETE CASCADE
);

-- Password: ClientPassword1!
-- is_admin = 1 so this account can access the Admin Panel
INSERT INTO local_reference.clients (email, password_hash, company_name, is_admin)
VALUES ('client@example.com', '$2b$12$IteTAzOIojaNQXA9QimmLeFwI2cBBqA4KRBafhh9OKp.5zdBk0.sm', 'BDA', 1)
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), company_name = VALUES(company_name), is_admin = VALUES(is_admin);
