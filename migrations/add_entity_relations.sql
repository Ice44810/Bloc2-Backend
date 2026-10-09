-- Relations manquantes sur une base Backend_node déjà créée.
-- CREATE TABLE IF NOT EXISTS ne rajoute pas les FK.
-- Inutile si le serveur Node a déjà tourné avec utils/db.js (ensureForeignKeys).

USE Backend_node;

UPDATE transactions t
LEFT JOIN categories c ON t.category_id = c.id
SET t.category_id = NULL
WHERE t.category_id IS NOT NULL AND c.id IS NULL;

ALTER TABLE categories
    ADD CONSTRAINT fk_categories_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE transactions
    ADD CONSTRAINT fk_transactions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE transactions
    ADD CONSTRAINT fk_transactions_category
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
