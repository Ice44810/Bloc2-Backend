const logger = require('../utils/logger');
const db = require('../utils/db');
const Transaction = require('../models/Transaction');

/**
 * Handler consolidé pour /api/transactions
 * Merge de routes/transactions.js + services/TransactionService + controllers/transactionsController
 */
async function handleTransactions(req, res, userSession) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;

    try {
        // GET /api/transactions
        if (path === '/api/transactions' && method === 'GET') {
            const filters = {
                categoryId: url.searchParams.get('category_id'),
                type: url.searchParams.get('type'),
                period: url.searchParams.get('period')
            };
            const transactions = await TransactionService.getTransactions(userSession.userId, filters);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(transactions.map(t => t.toJSON())));
            return;
        }

        // POST /api/transactions
        if (path === '/api/transactions' && method === 'POST') {
            const result = await TransactionService.createTransaction(userSession.userId, req.body);
            if (result.success) {
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result.transaction));
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: result.error }));
            }
            return;
        }

        // GET /api/transactions/:id
        const transactionIdMatch = path.match(/^\/api\/transactions\/(\d+)$/);
        if (transactionIdMatch && method === 'GET') {
            const transactionId = parseInt(transactionIdMatch[1]);
            const transaction = await TransactionService.getTransactionById(transactionId, userSession.userId);
            if (!transaction) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Transaction non trouvée' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(transaction.toJSON()));
            return;
        }

        // PUT /api/transactions/:id
        if (transactionIdMatch && method === 'PUT') {
            const transactionId = parseInt(transactionIdMatch[1]);
            const result = await TransactionService.updateTransaction(transactionId, userSession.userId, req.body);
            if (result.success) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Transaction mise à jour' }));
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: result.error }));
            }
            return;
        }

        // DELETE /api/transactions/:id
        if (transactionIdMatch && method === 'DELETE') {
            const transactionId = parseInt(transactionIdMatch[1]);
            const result = await TransactionService.deleteTransaction(transactionId, userSession.userId);
            if (result.success) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Transaction supprimée' }));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: result.error }));
            }
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: `Endpoint non trouvé : ${req.method} ${req.url}` }));
    } catch (err) {
        logger.error('Transactions handler error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Erreur serveur' }));
    }
}

// TransactionService class (copié/amélioré de services/TransactionService.js)
class TransactionService {
    static getTransactions(userId, filters = {}) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT t.*, c.name as category_name 
                FROM transactions t 
                LEFT JOIN categories c ON t.category_id = c.id 
                WHERE t.user_id = ?
            `;
            let params = [userId];

            if (filters.categoryId) {
                query += ' AND t.category_id = ?';
                params.push(filters.categoryId);
            }
            if (filters.type) {
                query += ' AND t.type = ?';
                params.push(filters.type);
            }
            if (filters.period) {
                if (filters.period === 'today') query += ' AND DATE(t.created_at) = CURDATE()';
                else if (filters.period === 'week') query += ' AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
                else if (filters.period === 'month') query += ' AND MONTH(t.created_at) = MONTH(CURDATE()) AND YEAR(t.created_at) = YEAR(CURDATE())';
                else if (filters.period === 'year') query += ' AND YEAR(t.created_at) = YEAR(CURDATE())';
            }
            query += ' ORDER BY t.created_at DESC';

            db.query(query, params, (err, results) => {
                if (err) return reject(err);
                resolve(results.map(row => Transaction.fromRow(row)));
            });
        });
    }

    static getTransactionById(transactionId, userId) {
        return new Promise((resolve, reject) => {
            db.query(
                'SELECT t.*, c.name as category_name FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE t.id = ? AND t.user_id = ?',
                [transactionId, userId],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results[0] ? Transaction.fromRow(results[0]) : null);
                }
            );
        });
    }

    static assertCategoryOwned(categoryId, userId) {
        if (!categoryId) return Promise.resolve({ ok: true });
        return db.queryPromise(
            'SELECT id FROM categories WHERE id = ? AND user_id = ?',
            [categoryId, userId]
        ).then((rows) => {
            if (!rows.length) {
                return { ok: false, error: 'Catégorie invalide ou elle ne vous appartient pas' };
            }
            return { ok: true };
        });
    }

    static createTransaction(userId, data) {
        return new Promise(async (resolve) => {
            const transaction = new Transaction({
                user_id: userId,
                title: data.title,
                amount: parseFloat(data.amount),
                type: data.type,
                category_id: data.category_id || null
            });
            const validation = transaction.validate();
            if (!validation.valid) return resolve({ success: false, error: validation.errors.join(', ') });

            const owned = await TransactionService.assertCategoryOwned(transaction.categoryId, userId);
            if (!owned.ok) return resolve({ success: false, error: owned.error });

            db.query(
                'INSERT INTO transactions (user_id, title, amount, type, category_id) VALUES (?, ?, ?, ?, ?)',
                [userId, transaction.title, transaction.amount, transaction.type, transaction.categoryId],
                (err, result) => {
                    if (err) return resolve({ success: false, error: 'Erreur DB' });
                    transaction.id = result.insertId;
                    resolve({ success: true, transaction: transaction.toJSON() });
                }
            );
        });
    }

    static updateTransaction(transactionId, userId, data) {
        return new Promise(async (resolve) => {
            const transaction = new Transaction({
                id: transactionId,
                user_id: userId,
                title: data.title,
                amount: parseFloat(data.amount),
                type: data.type,
                category_id: data.category_id || null
            });
            const validation = transaction.validate();
            if (!validation.valid) return resolve({ success: false, error: validation.errors.join(', ') });

            const owned = await TransactionService.assertCategoryOwned(transaction.categoryId, userId);
            if (!owned.ok) return resolve({ success: false, error: owned.error });

            db.query(
                'UPDATE transactions SET title = ?, amount = ?, type = ?, category_id = ? WHERE id = ? AND user_id = ?',
                [transaction.title, transaction.amount, transaction.type, transaction.categoryId, transactionId, userId],
                (err, result) => {
                    if (err || result.affectedRows === 0) return resolve({ success: false, error: 'Transaction non trouvée' });
                    resolve({ success: true });
                }
            );
        });
    }

    static deleteTransaction(transactionId, userId) {
        return new Promise((resolve) => {
            db.query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [transactionId, userId], (err, result) => {
                if (err || result.affectedRows === 0) return resolve({ success: false, error: 'Transaction non trouvée' });
                resolve({ success: true });
            });
        });
    }
}

module.exports = { handleTransactions, TransactionService };

