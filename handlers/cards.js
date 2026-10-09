const logger = require('../utils/logger');
const db = require('../utils/db');

/**
 * Handler consolidé pour /api/cards
 * Merge routes/cards.js + controllers/cardsController.js + services/CardService.js
 */
async function handleCards(req, res, userSession) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;

    try {
        // GET /api/cards/:id
        const cardIdMatch = path.match(/^\/api\/cards\/(\d+)$/);
        if (cardIdMatch) {
            const cardId = parseInt(cardIdMatch[1]);
            if (method === 'GET') {
                const card = await CardService.getCardById(cardId, userSession.userId);
                if (!card) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ message: 'Carte non trouvée' }));
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(card));
                return;
            }
            if (method === 'PUT') {
                const result = await CardService.updateCard(cardId, userSession.userId, req.body);
                res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
                return;
            }
            if (method === 'DELETE') {
                const result = await CardService.deleteCard(cardId, userSession.userId);
                res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
                return;
            }
        }

        // GET /api/cards
        if (path === '/api/cards' && method === 'GET') {
            const cards = await CardService.getCards(userSession.userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(cards));
            return;
        }

        // POST /api/cards
        if (path === '/api/cards' && method === 'POST') {
            const result = await CardService.createCard(userSession.userId, req.body);
            if (result.success) {
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result.card));
            } else {
                res.writeHead(result.status || 400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: result.error }));
            }
            return;
        }

        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Méthode non autorisée' }));
    } catch (err) {
        logger.error('Cards handler error', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Erreur serveur' }));
    }
}

// CardService consolidé (avec utils)
class CardService {
    static getCards(userId) {
        return new Promise((resolve, reject) => {
            db.query(
                'SELECT id, user_id, card_holder_name, last_4_digits, expiry_date, card_brand, created_at FROM cards WHERE user_id = ? ORDER BY created_at DESC',
                [userId],
                (err, results) => err ? reject(err) : resolve(results)
            );
        });
    }

    static getCardById(cardId, userId) {
        return new Promise((resolve, reject) => {
            db.query(
                'SELECT id, user_id, card_holder_name, last_4_digits, expiry_date, card_brand, created_at FROM cards WHERE id = ? AND user_id = ?',
                [cardId, userId],
                (err, results) => err ? reject(err) : resolve(results[0] || null)
            );
        });
    }

    // Extrait de CardService.createCard dans le fichier cards.js
    static createCard(userId, data) {
    return new Promise((resolve) => {
        const { cardNumber, cardHolderName, expiryDate } = data;
        
        // Nettoyage final côté serveur par sécurité
        const cleanNumber = cardNumber.replace(/[^0-9]/g, '');

        // Validation Luhn et format de base (16 chiffres pour Visa/Mastercard, 15 pour Amex)
        if (!CardService.isValidLuhn(cleanNumber)) {
            return resolve({ success: false, error: 'Numéro de carte invalide (Luhn)', status: 400 });
        }

        const last4Digits = cleanNumber.slice(-4);
        const brand = CardService.getCardBrand(cleanNumber);

        // Insertion en base (Utilise l'ID de session pour la sécurité)
        const newCard = { 
            user_id: userId, 
            card_holder_name: cardHolderName.trim(), 
            last_4_digits: last4Digits, 
            expiry_date: expiryDate, // ex: 2026-01
            card_brand: brand 
        };

        db.query('INSERT INTO cards SET ?', newCard, (err, result) => {
            if (err) return resolve({ success: false, error: err.message, status: 500 });
            resolve({ success: true, card: { id: result.insertId, ...newCard } });
        });
    });
}

    static updateCard(cardId, userId, data) {
        return new Promise((resolve) => {
            const { cardHolderName, expiryDate } = data;
            if (!cardHolderName || !expiryDate) return resolve({ success: false, error: 'Champs requis' });

            db.query('UPDATE cards SET card_holder_name = ?, expiry_date = ? WHERE id = ? AND user_id = ?', [cardHolderName, expiryDate, cardId, userId], (err, result) => {
                if (err || result.affectedRows === 0) return resolve({ success: false, error: 'Carte non trouvée' });
                resolve({ success: true });
            });
        });
    }

    static deleteCard(cardId, userId) {
        return new Promise((resolve) => {
            db.query('DELETE FROM cards WHERE id = ? AND user_id = ?', [cardId, userId], (err, result) => {
                if (err || result.affectedRows === 0) return resolve({ success: false, error: 'Carte non trouvée' });
                resolve({ success: true });
            });
        });
    }

    static getCardBrand(cardNumber) {
        const clean = cardNumber.replace(/[^0-9]/g, '');
        if (/^4/.test(clean)) return 'Visa';
        if (/^5[1-5]/.test(clean)) return 'Mastercard';
        if (/^3[47]/.test(clean)) return 'American Express';
        return 'Unknown';
    }

    static isValidLuhn(number) {
        const clean = number.replace(/[^0-9]/g, '');
        let sum = 0;
        for (let i = 0; i < clean.length; i++) {
            let intVal = parseInt(clean[i]);
            if (i % 2 === clean.length % 2) {
                intVal *= 2;
                if (intVal > 9) intVal -= 9;
            }
            sum += intVal;
        }
        return sum % 10 === 0 && clean.length > 0;
    }
}

module.exports = handleCards;

