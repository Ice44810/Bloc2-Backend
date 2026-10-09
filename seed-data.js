const bcrypt = require('bcrypt');
const db = require('./utils/db');
const logger = require('./utils/logger');

async function seed() {
  try {
    // Fix DB context first
    await new Promise((resolve, reject) => {
      db.query("USE Backend_node", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 1. Create sample user if none
    const users = await db.queryPromise('SELECT id FROM users LIMIT 1');
    let userId;
    if (users.length === 0) {
      const hashedPassword = await bcrypt.hash('password123', 12);
      const result = await db.queryPromise(
        `INSERT INTO users (fullName, email, password) VALUES (?, ?, ?)`,
        ['Test User', 'test@example.com', hashedPassword]
      );
      userId = result.insertId;
      logger.info(`Created sample user ID: ${userId}`);
    } else {
      userId = users[0].id;
      logger.info(`Using existing user ID: ${userId}`);
    }

    // 2. Create sample categories for user
    await db.queryPromise(
      `INSERT IGNORE INTO categories (user_id, name) VALUES 
        (${userId}, 'Salaire'),
        (${userId}, 'Courses'),
        (${userId}, 'Restaurant'),
        (${userId}, 'Transport'),
        (${userId}, 'Loisirs')`
    );

    // Get category IDs
    const categories = await db.queryPromise(
      'SELECT id FROM categories WHERE user_id = ?', [userId]
    );
    const catMap = {};
    categories.forEach(cat => catMap[cat.name] = cat.id);

    // 3. Insert 8 sample transactions (mix income/expense, recent dates)
    const transactions = [
      { title: 'Salaire mensuel', amount: 2500.00, type: 'income', category: 'Salaire', daysAgo: 1 },
      { title: 'Courses supermarché', amount: 85.50, type: 'expense', category: 'Courses', daysAgo: 2 },
      { title: 'Déjeuner restaurant', amount: 32.00, type: 'expense', category: 'Restaurant', daysAgo: 3 },
      { title: 'Abonnement métro', amount: 75.00, type: 'expense', category: 'Transport', daysAgo: 4 },
      { title: 'Remboursement ami', amount: 120.00, type: 'income', category: null, daysAgo: 5 },
      { title: "Cinéma IMAX", amount: 45.50, type: 'expense', category: 'Loisirs', daysAgo: 6 },
      { title: 'Prime performance', amount: 450.00, type: 'income', category: 'Salaire', daysAgo: 6 },
      { title: 'Café x3', amount: 12.30, type: 'expense', category: 'Restaurant', daysAgo: 7 }
    ];

    for (const tx of transactions) {
      const categoryId = catMap[tx.category] || null;
      const createdAt = new Date(Date.now() - tx.daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      await db.queryPromise(
        `INSERT INTO transactions (user_id, title, amount, type, category_id, created_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, tx.title, tx.amount, tx.type, categoryId, createdAt]
      );
    }

    logger.info(`Seeded ${transactions.length} transactions for user ${userId}`);
    logger.info('✅ Demo data ready! Login: test@example.com / password123');
    logger.info('Test: http://localhost:3000/bankhistory.html');

  } catch (error) {
    logger.error('Seed error:', error);
  } finally {
    db.end();
  }
}

seed();

