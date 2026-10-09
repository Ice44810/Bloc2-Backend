const logger = require('../utils/logger');
const db = require('../utils/db');
const { StatsService } = require('./stats');

// Services simulés (pas de vrai fournisseur derrière)
const SERVICES = [
    { id: 1, name: 'Mobile', icon: 'phone', providers: ['Orange', 'Free'] },
    { id: 2, name: 'Internet', icon: 'wifi', providers: ['Free', 'SFR'] },
    { id: 3, name: 'Électricité', icon: 'lightning', providers: ['EDF'] },
    { id: 4, name: 'Eau', icon: 'droplet', providers: ['Veolia'] },
    { id: 5, name: 'Film', icon: 'film', providers: ['Netflix', 'Disney+', 'Gaumont', 'Pathé'] }
];

/**
 * Handler for services/bills
 */
async function handleServices(req, res, userSession) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;

    try {
        // GET /api/services
        if (path === '/api/services' && method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(SERVICES));
            return;
        }

        // POST /api/services/pay/:serviceId   Corps : { amount, provider }
        const payMatch = path.match(/^\/api\/services\/pay\/(\d+)$/);
        if (payMatch && method === 'POST') {
            const service = SERVICES.find(s => s.id === parseInt(payMatch[1]));
            const amount = parseFloat(req.body.amount);
            const provider = req.body.provider;

            if (!service || !service.providers.includes(provider) || isNaN(amount) || amount <= 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, message: 'Service, fournisseur ou montant invalide' }));
            }

            const balance = await StatsService.getBalance(userSession.userId);
            if (parseFloat(balance) < amount) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, message: 'Solde insuffisant' }));
            }

            // La facture devient une dépense (sans catégorie : chaque utilisateur a ses propres catégories)
            await db.queryPromise('INSERT INTO transactions (user_id, title, amount, type) VALUES (?, ?, ?, "expense")', [userSession.userId, `Facture ${service.name} - ${provider}`, amount]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Facture payée' }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: `Endpoint non trouvé : ${req.method} ${req.url}` }));
    } catch (err) {
        logger.error('Services handler error', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Erreur serveur' }));
    }
}

module.exports = handleServices;

