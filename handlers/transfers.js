const logger = require('../utils/logger');
const db = require('../utils/db');
const { StatsService } = require('./stats'); // Pour vérifier le solde

/**
 * Handler for transfers/payments
 */
async function handleTransfers(req, res, userSession) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;

    try {
        // POST /api/transfers/p2p
        // Corps : { amount, title?, recipient_id }  (contact enregistré)
        //      ou { amount, title?, recipient_name, recipient_identifier }  (compte saisi à la main)
        if (path === '/api/transfers/p2p' && method === 'POST') {
            const { recipient_id, recipient_name, recipient_identifier, amount, title } = req.body;
            const amt = parseFloat(amount);
            if (isNaN(amt) || amt <= 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, message: 'Montant invalide' }));
            }

            // Bénéficiaire : soit un contact enregistré (vérifié en base), soit un nom saisi
            let recipientName;
            if (recipient_id) {
                const [recipient] = await db.queryPromise('SELECT * FROM recipients WHERE id = ? AND user_id = ?', [recipient_id, userSession.userId]);
                if (!recipient) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success: false, message: 'Bénéficiaire introuvable' }));
                }
                recipientName = recipient.name;
            } else if (recipient_name && recipient_identifier) {
                recipientName = String(recipient_name).trim();
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, message: 'Bénéficiaire manquant' }));
            }

            // Vérifier le solde
            const balance = await StatsService.getBalance(userSession.userId);
            if (parseFloat(balance) < amt) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, message: 'Solde insuffisant' }));
            }

            // Dépense chez l'émetteur
            const transactionTitle = (title && String(title).trim()) || `Transfert à ${recipientName}`;
            const result = await db.queryPromise('INSERT INTO transactions (user_id, title, amount, type) VALUES (?, ?, ?, "expense")', [userSession.userId, transactionTitle, amt]);

            const newBalance = await StatsService.getBalance(userSession.userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Transfert effectué', transactionId: result.insertId, balance: parseFloat(newBalance).toFixed(2) }));
            return;
        }

        // POST /api/transfers/confirm/:id
        const confirmMatch = path.match(/^\/api\/transfers\/confirm\/(\d+)$/);
        if (confirmMatch && method === 'POST') {
            // Mark pending transfer as confirmed, execute above
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Confirmed' }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: `Endpoint non trouvé : ${req.method} ${req.url}` }));
    } catch (err) {
        logger.error('Transfers handler error', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Erreur serveur' }));
    }
}

module.exports = handleTransfers;
