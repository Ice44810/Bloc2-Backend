const cookie = require('cookie');
const sessions = {}; // Injected from server.js

/**
 * Middleware d'authentification
 */
function requireAuth(req, res, next) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const sessionId = cookies.sessionId;
    req.userSession = sessions[sessionId];

    if (!req.userSession) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Non autorisé' }));
        return;
    }
    next();
}

module.exports = { requireAuth };

