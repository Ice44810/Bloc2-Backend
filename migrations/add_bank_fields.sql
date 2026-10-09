-- Migration: Add bank fields to users table
-- Run: mysql -u root -p budget_app_db < migrations/add_bank_fields.sql

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS iban VARCHAR(34) NULL COMMENT 'IBAN du compte bancaire',
ADD COLUMN IF NOT EXISTS bic_swift VARCHAR(11) NULL COMMENT 'BIC/SWIFT code',
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100) NULL COMMENT 'Nom de la banque',
ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Solde actuel du compte';

-- Update existing users with sample data (adjust IDs/emails as needed)
-- UPDATE users SET iban = 'FR7612345678901234567890123', bic_swift = 'BUDFFTXX', bank_name = 'Budget Banque Digitale', balance = 3466.90 WHERE email = 'test@example.com';

-- Verify:
-- SELECT id, fullName, iban, bic_swift, bank_name, balance FROM users LIMIT 5;

