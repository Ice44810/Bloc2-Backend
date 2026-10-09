const logger = require('../utils/logger');
const db = require('../utils/db');

/**
 * Handler consolidé pour /api/recipients
 * Merge routes/recipients.js + controllers/recipientsController.js + services/RecipientService.js
 */
async function handleRecipients(req, res, userSession) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;

    try {
        // GET /api/recipients/:id
        const recipientIdMatch = path.match(/^\/api\/recipients\/(\d+)$/);
        if (recipientIdMatch) {
            const recipientId = parseInt(recipientIdMatch[1]);
            if (method === 'GET') {
                // Get single - implement based on controller pattern
                const recipient = await RecipientService.getRecipientById(recipientId, userSession.userId);
                if (!recipient) {
                    res.writeHead(404);
                    return res.end(JSON.stringify({ message: 'Bénéficiaire non trouvé' }));
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(recipient));
                return;
            }
            if (method === 'PUT') {
                // Update
                const result = await RecipientService.updateRecipient(recipientId, userSession.userId, req.body);
                res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
                return;
            }
            if (method === 'DELETE') {
                const result = await RecipientService.deleteRecipient(recipientId, userSession.userId);
                res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
                return;
            }
        }

        // GET /api/recipients
        if (path === '/api/recipients' && method === 'GET') {
            const recipients = await RecipientService.getRecipients(userSession.userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(recipients));
            return;
        }

        // POST /api/recipients
        if (path === '/api/recipients' && method === 'POST') {
            const result = await RecipientService.createRecipient(userSession.userId, req.body);
            if (result.success) {
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result.recipient));
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: result.error }));
            }
            return;
        }

        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Méthode non autorisée' }));
    } catch (err) {
        logger.error('Recipients handler error', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Erreur serveur' }));
    }
}

// RecipientService (basic implementation based on pattern, as controller not read yet)
class RecipientService {
    static getRecipients(userId) {
        return new Promise((resolve, reject) => {
            db.query('SELECT * FROM recipients WHERE user_id = ? ORDER BY name', [userId], (err, results) => {
                err ? reject(err) : resolve(results);
            });
        });
    }

    static getRecipientById(recipientId, userId) {
        return new Promise((resolve, reject) => {
            db.query('SELECT * FROM recipients WHERE id = ? AND user_id = ?', [recipientId, userId], (err, results) => {
                err ? reject(err) : resolve(results[0] || null);
            });
        });
    }

    static createRecipient(userId, data) {
        return new Promise((resolve) => {
            const { name, identifier, type } = data;
            if (!name || !identifier || !['phone', 'bank'].includes(type)) return resolve({ success: false, error: 'Champs invalides' });
            db.query('INSERT INTO recipients (user_id, name, identifier, type) VALUES (?, ?, ?, ?)', [userId, name, identifier, type], (err, result) => {
                if (err) return resolve({ success: false, error: 'Erreur DB' });
                resolve({ success: true, recipient: { id: result.insertId, user_id: userId, name, identifier, type } });
            });
        });
    }

    static updateRecipient(recipientId, userId, data) {
        return new Promise((resolve) => {
            const { name, identifier, type } = data;
            db.query('UPDATE recipients SET name = ?, identifier = ?, type = ? WHERE id = ? AND user_id = ?', [name, identifier, type, recipientId, userId], (err, result) => {
                if (err || result.affectedRows === 0) return resolve({ success: false, error: 'Bénéficiaire non trouvé' });
                resolve({ success: true });
            });
        });
    }

    static deleteRecipient(recipientId, userId) {
        return new Promise((resolve) => {
            db.query('DELETE FROM recipients WHERE id = ? AND user_id = ?', [recipientId, userId], (err, result) => {
                if (err || result.affectedRows === 0) return resolve({ success: false, error: 'Bénéficiaire non trouvé' });
                resolve({ success: true });
            });
        });
    }
}

module.exports = handleRecipients;

