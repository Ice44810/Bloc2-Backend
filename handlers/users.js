const db = require('../utils/db');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Codes de réinitialisation, par email : { hash, userId, expires, attempts }
// (gardés en mémoire : ils disparaissent si le serveur redémarre)
const resetCodes = new Map();
const MAX_RESET_ATTEMPTS = 5;
const otps = new Map();

/**
 * Handler consolidé pour /api/users
 * Merge routes/users.js + controllers/usersController.js + services/AuthService.js
 */
async function handleUsers(req, res, userSession) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    try {
        // GET /api/users/profile
        if (path === '/api/users/profile' && req.method === 'GET') {
            const user = await getProfile(userSession.userId);
            if (!user) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ message: 'Utilisateur non trouvé' }));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(user));
            return;
        }

        // PUT /api/users/profile
        if (path === '/api/users/profile' && req.method === 'PUT') {
            const result = await updateProfile(userSession.userId, req.body);
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
        }

        // POST /api/users/change-password
        if (path === '/api/users/change-password' && req.method === 'POST') {
            const result = await changePassword(userSession.userId, req.body.oldPassword, req.body.newPassword);
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
        }

        // POST /api/users/reset-password   (public : l'utilisateur n'est pas connecté)
        if (path === '/api/users/reset-password' && req.method === 'POST') {
            const result = await requestPasswordReset(req.body.email);
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
        }

        // POST /api/users/reset-password-confirm   (public)   Corps : { email, code, newPassword }
        if (path === '/api/users/reset-password-confirm' && req.method === 'POST') {
            const result = await confirmPasswordReset(req.body.email, req.body.code, req.body.newPassword);
            res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
        }

        // POST /api/users/otp-generate
        if (path === '/api/users/otp-generate' && req.method === 'POST') {
            const code = crypto.randomInt(100000, 999999).toString();
            const hash = await bcrypt.hash(code, 12);
            otps.set(userSession.userId, { hash, expires: Date.now() + 5 * 60 * 1000 });
            logger.info(`OTP generated for user ${userSession.userId}`, { email: userSession.email }); // Send SMS/Email in prod
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'OTP generated (console)' }));
            return;
        }

        // POST /api/users/otp-verify
        if (path === '/api/users/otp-verify' && req.method === 'POST') {
            const stored = otps.get(userSession.userId);
            if (!stored || stored.expires < Date.now()) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'OTP expired' }));
                return;
            }
            const valid = await bcrypt.compare(req.body.otp, stored.hash);
            if (valid) {
                otps.delete(userSession.userId);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid OTP' }));
            }
            return;
        }

        // GET /api/users (admin only)
        if (path === '/api/users' && req.method === 'GET') {
            if (userSession.role !== 'admin') {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ message: 'Accès refusé' }));
            }
            const users = await db.queryPromise('SELECT id, email, role, fullName, phone, created_at FROM users');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(users));
            return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ message: `Endpoint non trouvé : ${req.method} ${req.url}` }));
    } catch (err) {
        logger.error('Users handler error', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Erreur serveur' }));
    }
}

// Fonctions utilitaires / service logic
async function getProfile(userId) {
    return new Promise((resolve) => {
        // Uniquement les colonnes qui existent dans la table users (voir utils/db.js),
        // et jamais de donnée secrète (mot de passe...) : cette réponse part vers le navigateur.
        db.query(
            'SELECT id, email, role, fullName, phone, address, postcode, ville, iban, bic_swift, bank_name, balance FROM users WHERE id = ?',
            [userId],
            (err, results) => {
                if (err) {
                    logger.error('Get profile query failed', { error: err.message });
                    return resolve(null);
                }
                resolve(results[0]);
            }
        );
    });
}

async function updateProfile(userId, data) {
    const { email, fullName, phone, address, postcode, ville, notif_prefs, twofa_enabled } = data;
    const fields = [], values = [];
    if (email !== undefined) { fields.push('email = ?'); values.push(email); }
    if (fullName !== undefined) { fields.push('fullName = ?'); values.push(fullName); }
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
    if (address !== undefined) { fields.push('address = ?'); values.push(address); }
    if (postcode !== undefined) { fields.push('postcode = ?'); values.push(postcode); }
    if (ville !== undefined) { fields.push('ville = ?'); values.push(ville); }
    if (notif_prefs !== undefined) { fields.push('notif_prefs = ?'); values.push(JSON.stringify(notif_prefs)); }
    if (twofa_enabled !== undefined) { fields.push('twofa_enabled = ?'); values.push(twofa_enabled); }
    values.push(userId);

    if (fields.length === 0) return { success: false, error: 'Aucune donnée' };

    return new Promise((resolve) => {
        db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, (err, result) => {
            if (err) return resolve({ success: false, error: 'Erreur DB' });
            resolve({ success: true });
        });
    });
}

function isValidPassword(password) {
    return typeof password === 'string' && password.length >= 6 && password.length <= 20;
}

async function changePassword(userId, oldPassword, newPassword) {
    if (!oldPassword || !isValidPassword(newPassword)) {
        return { success: false, message: 'Le nouveau mot de passe doit contenir entre 6 et 20 caractères' };
    }
    const [user] = await db.queryPromise('SELECT password FROM users WHERE id = ?', [userId]);
    if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
        return { success: false, message: 'Ancien mot de passe incorrect' };
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await db.queryPromise('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
    return { success: true, message: 'Mot de passe modifié' };
}

async function requestPasswordReset(email) {
    if (!email) return { success: false, message: 'Email requis' };
    // Même réponse que l'email existe ou non : on ne révèle pas quels comptes existent
    const response = { success: true, message: 'Si ce compte existe, un code a été envoyé' };

    const [user] = await db.queryPromise('SELECT id FROM users WHERE email = ?', [email]);
    if (!user) return response;

    const code = crypto.randomInt(100000, 1000000).toString(); // 6 chiffres
    const hash = await bcrypt.hash(code, 12);
    resetCodes.set(email, { hash, userId: user.id, expires: Date.now() + 15 * 60 * 1000, attempts: 0 });

    // Pas encore d'envoi d'email : en développement, le code est écrit dans les logs du serveur
    logger.info('Password reset code generated', { email, code });
    return response;
}

async function confirmPasswordReset(email, code, newPassword) {
    const stored = resetCodes.get(email);
    if (!stored || stored.expires < Date.now() || stored.attempts >= MAX_RESET_ATTEMPTS) {
        resetCodes.delete(email);
        return { success: false, message: 'Code expiré, recommencez la demande' };
    }
    if (!isValidPassword(newPassword)) {
        return { success: false, message: 'Le mot de passe doit contenir entre 6 et 20 caractères' };
    }
    if (!(await bcrypt.compare(String(code || ''), stored.hash))) {
        stored.attempts++; // limite les essais pour empêcher de deviner le code
        return { success: false, message: 'Code incorrect' };
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.queryPromise('UPDATE users SET password = ? WHERE id = ?', [hashed, stored.userId]);
    resetCodes.delete(email);
    return { success: true, message: 'Mot de passe réinitialisé' };
}

module.exports = handleUsers;

