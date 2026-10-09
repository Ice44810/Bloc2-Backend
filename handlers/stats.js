const logger = require('../utils/logger');
const db = require('../utils/db');

/**
 * Handler consolidé pour stats, balance, home, topup
 * Merge routes/stats.js + services/StatsService.js + TransactionService parts
 */
async function handleStats(req, res, userSession) {
    let responseSent = false;

    const sendResponse = (status, data, contentType = 'application/json') => {
        if (responseSent || res.headersSent) return;
        responseSent = true;
        res.writeHead(status, { 'Content-Type': contentType });
        res.end(JSON.stringify(data));
    };

    const sendError = (status, message) => {
        if (responseSent || res.headersSent) return;
        responseSent = true;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message }));
    };

    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;

    try {
        // POST /api/topup
        if (path === '/api/topup' && method === 'POST') {
            const amount = parseFloat(req.body?.amount);
            if (!amount || amount <= 0) {
                return sendError(400, 'Montant invalide');
            }
            // Create income transaction
            const result = await db.queryPromise('INSERT INTO transactions (user_id, title, amount, type) VALUES (?, ?, ?, ?)', [userSession.userId, 'Recharge', amount, 'income']);
            const balance = await StatsService.getBalance(userSession.userId);
            return sendResponse(200, { success: true, balance: parseFloat(balance).toFixed(2), transactionId: result.insertId });
        }

        // GET /api/stats?period=week|month|year
        if (path === '/api/stats' && method === 'GET') {
            const filters = {};
            const period = url.searchParams.get('period');
            if (period) filters.period = period;
            const stats = await StatsService.getOverallStats(userSession.userId, filters);
            return sendResponse(200, stats);
        }

        // NEW: GET /api/stats/daily_evolution?days=7|30|custom
        if (path === '/api/stats/daily_evolution' && method === 'GET') {
            const days = parseInt(url.searchParams.get('days')) || 7;
            const start_date = url.searchParams.get('start_date');
            const end_date = url.searchParams.get('end_date');
            if (start_date && end_date) {
                const data = await StatsService.getCustomDailyEvol(userSession.userId, start_date, end_date);
                return sendResponse(200, data);
            } else {
                const data = await StatsService.getDailyEvol(userSession.userId, days);
                return sendResponse(200, { daily_evolution: data });
            }
        }

        // GET /api/balance
        if (path === '/api/balance' && method === 'GET') {
            const balance = await StatsService.getBalance(userSession.userId);
            return sendResponse(200, { balance: parseFloat(balance).toFixed(2) });
        }

        // GET /api/home
        if (path === '/api/home' && method === 'GET') {
            const [user] = await db.queryPromise('SELECT id, fullName, email FROM users WHERE id = ?', [userSession.userId]);
            const [balance, recent] = await Promise.all([
                StatsService.getBalance(userSession.userId),
                db.queryPromise('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [userSession.userId])
            ]);
            
            const displayUsername = user?.fullName || (user?.email ? user.email.split('@')[0] : 'Utilisateur');
            
            return sendResponse(200, {
                balance: parseFloat(balance).toFixed(2),
                username: displayUsername,
                userId: user?.id,
                lastTransactions: recent
            });
        }
        
        // GET /api/stats/daily
        if (path.startsWith('/api/stats/daily') && method === 'GET') {
            const days = parseInt(url.searchParams.get('days')) || 30;
            const data = await StatsService.getDailyEvol(userSession.userId, days);
            return sendResponse(200, data);
        }

        // GET /api/stats/monthly
        if (path.startsWith('/api/stats/monthly') && method === 'GET') {
            const months = parseInt(url.searchParams.get('months')) || 12;
            const data = await StatsService.getMonthlyEvol(userSession.userId, months);
            return sendResponse(200, data);
        }

        // GET /api/stats/pie?type=income|expense
        if (path === '/api/stats/pie' && method === 'GET') {
            const type = url.searchParams.get('type') || 'expense';
            const data = await StatsService.getPieData(userSession.userId, type);
            return sendResponse(200, data);
        }

        // GET /api/stats/line
        if (path === '/api/stats/line' && method === 'GET') {
            const months = parseInt(url.searchParams.get('months')) || 6;
            const data = await StatsService.getLineData(userSession.userId, months);
            return sendResponse(200, data);
        }

        // GET /api/stats/rewards
        if (path === '/api/stats/rewards' && method === 'GET') {
            const data = await StatsService.getRewards(userSession.userId);
            return sendResponse(200, data);
        }

        return sendError(404, `Endpoint non trouvé : ${req.method} ${req.url}`);
    } catch (err) {
        logger.error('Stats handler error', err);
        if (!responseSent && !res.headersSent) {
            sendError(500, 'Erreur serveur');
        }
    }
}

class StatsService {
    static async getBalance(userId) {
        const results = await db.queryPromise(`
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) - 
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as balance
            FROM transactions WHERE user_id = ?
        `, [userId]);
        return results[0].balance;
    }

    static async getOverallStats(userId, filters = {}) {
        let query = `
            SELECT 
                COUNT(*) as totalTransactions,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense,
                AVG(amount) as avgTransaction
            FROM transactions WHERE user_id = ?
        `;
        let params = [userId];

        if (filters.period) {
            if (filters.period === 'week') {
                query += ' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
            } else if (filters.period === 'month') {
                query += ' AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
            } else if (filters.period === 'year') {
                query += ' AND YEAR(created_at) = YEAR(NOW())';
            }
        }

        const results = await db.queryPromise(query, params);
        return results[0];
    }

    static async getDailyEvol(userId, days = 30) {
        try {
            const end = new Date();
            const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
            const results = await db.queryPromise(`
                SELECT DATE(created_at) as date, 
                       (SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) - 
                        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)) as net
                FROM transactions WHERE user_id = ? AND created_at >= ? GROUP BY DATE(created_at) ORDER BY date DESC LIMIT ?
            `, [userId, start, days]);
            // Fill missing days with 0
            const data = [];
            const today = new Date();
            today.setHours(0,0,0,0);
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const dayData = results.find(r => r.date === dateStr) || { date: dateStr, net: 0 };
                data.push(dayData);
            }
            return data;
        } catch (err) {
            logger.error('getDailyEvol error', err);
            return [];
        }
    }

    static async getCustomDailyEvol(userId, start_date, end_date) {
        try {
            const results = await db.queryPromise(`
                SELECT DATE(created_at) as date,
                       (SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) - 
                        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)) as net
                FROM transactions 
                WHERE user_id = ? AND created_at >= ? AND created_at <= ? 
                GROUP BY DATE(created_at) ORDER BY date ASC
            `, [userId, start_date, end_date]);
            return results;
        } catch (err) {
            logger.error('getCustomDailyEvol error', err);
            return [];
        }
    }

    static async getMonthlyEvol(userId, months = 12) {
        try {
            const end = new Date();
            const start = new Date(end.getTime() - months * 30 * 24 * 60 * 60 * 1000);
            const results = await db.queryPromise(`
                SELECT DATE_FORMAT(created_at, '%Y-%m') as month,
                       SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
                FROM transactions WHERE user_id = ? AND created_at >= ? GROUP BY month ORDER BY month DESC LIMIT ?
            `, [userId, start, months]);
            return results;
        } catch (err) {
            logger.error('getMonthlyEvol error', err);
            return [];
        }
    }

    static async getPieData(userId, type) {
        try {
            const results = await db.queryPromise(`
                SELECT c.name, SUM(t.amount) as total 
                FROM transactions t 
                LEFT JOIN categories c ON t.category_id = c.id 
                WHERE t.user_id = ? AND t.type = ? 
                GROUP BY t.category_id, c.name ORDER BY total DESC LIMIT 10
            `, [userId, type]);
            return results;
        } catch (err) {
            logger.error('getPieData error', err);
            return [];
        }
    }

    static async getLineData(userId, months = 6) {
        try {
            const results = await db.queryPromise(`
                SELECT DATE_FORMAT(created_at, '%Y-%m') as month, type, SUM(amount) as total
                FROM transactions WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH) 
                GROUP BY month, type ORDER BY month DESC
            `, [userId, months]);
            return results;
        } catch (err) {
            logger.error('getLineData error', err);
            return [];
        }
    }

    static async getRewards(userId) {
        const balance = await StatsService.getBalance(userId);
        return {
            points: parseFloat(balance) * 0.01,
            level: parseFloat(balance) > 1000 ? 'Gold' : parseFloat(balance) > 500 ? 'Silver' : 'Bronze',
            nextLevel: 1000,
            favorites: []
        };
    }
}

module.exports = handleStats;
// Exporté aussi pour transfers.js et services.js, qui ont besoin du solde
module.exports.StatsService = StatsService;
