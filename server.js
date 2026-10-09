require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');

const db = require('./utils/db');
const logger = require('./utils/logger');
const parseBody = require('./middleware/parseBody');
const { requireAuth } = require('./middleware/auth');
const { handleTransactions } = require('./handlers/transactions');
const handleUsers = require('./handlers/users');
const handleCategories = require('./handlers/categories');
const handleCards = require('./handlers/cards');
const handleRecipients = require('./handlers/recipients');
const handleStats = require('./handlers/stats');
const handleTransfers = require('./handlers/transfers');
const handleServices = require('./handlers/services');

// Clé secrète pour signer les jetons (à mettre dans un fichier .env en production)
const JWT_SECRET = process.env.JWT_SECRET;

// ================= HELPER FUNCTIONS =================

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function setSecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
}


// ================= SERVER =================

const server = http.createServer(async (req, res) => {

    const startTime = Date.now();
    const method = req.method;

    // Normalisation de l'adresse (utile surtout dans Postman) :
    // - "/api/cards/" est traité comme "/api/cards" (on retire le "/" final)
    // - "/api/login" et "/api/register" sont acceptés comme "/login" et "/register"
    const [rawPath, query] = req.url.split('?');
    let normalizedPath = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
    if (normalizedPath === '/api/login' || normalizedPath === '/api/register') {
        normalizedPath = normalizedPath.replace('/api', '');
    }
    req.url = normalizedPath + (query !== undefined ? '?' + query : '');
    const requestUrl = req.url;

        logger.info('Incoming request', { method, url: requestUrl });

        // ================= STATIC FILES =================

        if (requestUrl.toLowerCase().startsWith('/public/')) {
        // Les pages du frontend écrivent "../Public/Assets/..." alors que le dossier est "public/assets"
        // (Linux fait la différence entre majuscules et minuscules). On normalise donc ces deux dossiers.
        // decodeURIComponent transforme "Alex%20Tran.jpg" en "Alex Tran.jpg".
        const relativePath = decodeURIComponent(requestUrl.split('?')[0])
            .replace(/^\/public\//i, 'public/')
            .replace(/^public\/assets\//i, 'public/assets/');
        const publicDir = path.join(__dirname, 'public');
        const filePath = path.join(__dirname, relativePath);

        // Sécurité : interdit de sortir du dossier public (ex: /public/../.env)
        if (!filePath.startsWith(publicDir + path.sep)) {
            res.writeHead(403);
            return res.end('Accès interdit');
        }

        fs.readFile(filePath, (err, content) => {

            if (err) {
                logger.error('Static file not found', { path: filePath });
                res.writeHead(404);
                return res.end('Static file not found');
            }

            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.svg': 'image/svg+xml',
                '.gif': 'image/gif',
                '.ico': 'image/x-icon'
            };

            const duration = Date.now() - startTime;
            
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
            res.end(content);
            logger.logRequest(method, requestUrl, 200, duration);
        });

        return;
    }

    // ================= REGISTER =================

    if (requestUrl === '/register' && method === 'POST') {
    parseBody(req, res).then(async () => {
        // Extraction des données (vérifie que parseBody remplit bien req.body)
        const { fullName, email, password } = req.body || {};

        // 1. Validation des champs vides
        if (!fullName || !email || !password) {
            return sendJson(res, 400, { message: 'Nom complet, email et mot de passe requis' });
        }

        try {
            // 2. Vérifier si l'email existe déjà
            const existingUser = await db.queryPromise('SELECT id FROM users WHERE email = ?', [email]);
            
            if (existingUser.length > 0) {
                return sendJson(res, 409, { message: 'Cet email est déjà associé à un compte' });
            }

            // 3. Hasher le mot de passe
            const hashedPassword = await bcrypt.hash(password, 12);

            // 4. Insérer l'utilisateur
            const result = await db.queryPromise(
                'INSERT INTO users (fullName, email, password, role) VALUES (?, ?, ?, ?)',
                [fullName, email, hashedPassword, 'user']
            );

            logger.info('User registered', { userId: result.insertId });

            // CORRECTIF : Au lieu d'un 302, on envoie un succès JSON
            // Le frontend verra response.ok === true et fera la redirection lui-même
            return sendJson(res, 201, { 
                message: 'Inscription réussie', 
                userId: result.insertId 
            });

        } catch (error) {
            logger.error('Registration failed', { 
                error: error.message, 
                stack: error.stack,
                email: email 
            });
            return sendJson(res, 500, { message: 'Erreur interne lors de l\'inscription' });
        }
    }).catch(err => {
        logger.error('Parse body error on register', { error: err.message });
        sendJson(res, 400, { message: 'Erreur lors du traitement des données' });
    });

    return;
}

    // ================= LOGIN =================

if (requestUrl === '/login' && method === 'POST') {
    // 1. On laisse parseBody gérer la lecture du flux entièrement
    parseBody(req, res).then(() => {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return sendJson(res, 400, { message: 'Email et mot de passe requis' });
        }

        db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
            if (err) {
                logger.error('Login query failed', { error: err.message });
                return sendJson(res, 500, { message: 'Erreur serveur' });
            }

            if (!results.length) {
                return sendJson(res, 401, { message: 'Identifiants invalides' });
            }

            const user = results[0];
            
            let match = false;
            try {
                // Utilisation de bcrypt comme dans ton code
                match = await bcrypt.compare(password, user.password);
            } catch (bcryptError) {
                logger.error('Bcrypt compare error', { error: bcryptError.message });
                return sendJson(res, 500, { message: 'Erreur serveur' });
            }

            if (!match) {
                return sendJson(res, 401, { message: 'Identifiants invalides' });
            }

            // 1. Création du Token JWT
            const token = jwt.sign(
                { userId: user.id, email: user.email, role: user.role },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            // 2. On garde le cookie pour la navigation entre pages HTML
            res.setHeader('Set-Cookie', cookie.serialize('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 24 * 7,
                path: '/'
            }));

            // 3. On renvoie aussi le token en JSON pour que le client API puisse le stocker
            return sendJson(res, 200, { success: true, token, message: 'Connexion réussie' });

        });
    }).catch(err => {
        logger.error('Parse body error', err);
        sendJson(res, 400, { message: 'Erreur lors de la lecture des données' });
    });

    return; // Important pour ne pas continuer dans le reste du serveur
}

    // ================= LOGOUT =================

    if (requestUrl === '/logout') {
        const cookies = cookie.parse(req.headers.cookie || '');

        res.setHeader('Set-Cookie',
            cookie.serialize('token', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                expires: new Date(0),
                path: '/'
            })
        );

        res.writeHead(302, { Location: '/login.html' });
        res.end();
        return;
    }

    // ================= API =================

        // API routes
        if (requestUrl.startsWith('/api/')) {
            logger.info('API request', { method, url: requestUrl });

            try {
                // Parse body first
                await new Promise((resolve, reject) => {
                    parseBody(req, res).then(resolve).catch((err) => {
                        logger.error('ParseBody error', err);
                        if (!res.headersSent) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Invalid request body' }));
                        }
                        reject(err);
                    });
                });

                // Routes API accessibles sans être connecté (mot de passe oublié)
                const publicApiRoutes = ['/api/users/reset-password', '/api/users/reset-password-confirm'];
                if (publicApiRoutes.includes(requestUrl.split('?')[0]) && method === 'POST') {
                    return handleUsers(req, res, null);
                }

                // --- MIDDLEWARE DE VÉRIFICATION DU TOKEN ---
                const cookies = cookie.parse(req.headers.cookie || '');
                const authHeader = req.headers.authorization;
                let token = null;

                // Priorité au Header Authorization, sinon fallback sur le Cookie
                if (authHeader && authHeader.startsWith('Bearer ')) {
                    token = authHeader.split(' ')[1];
                } else {
                    token = cookies.token;
                }
                
                try {
                    if (!token) {
                        return sendJson(res, 401, { error: 'Token manquant : Authentifiez-vous d\'abord via /login' });
                    }
                    req.userSession = jwt.verify(token, JWT_SECRET);
                } catch (err) {
                    logger.error('JWT Verification failed', { error: err.message });
                    if (!res.headersSent) {
                        sendJson(res, 401, { error: 'Token invalide ou expiré', detail: err.message });
                    }
                    return;
                }

                // Route vers handler
                if (requestUrl.startsWith('/api/transactions')) return handleTransactions(req, res, req.userSession);
                if (requestUrl.startsWith('/api/users')) return handleUsers(req, res, req.userSession);
                if (requestUrl.startsWith('/api/categories')) return handleCategories(req, res, req.userSession);
                if (requestUrl.startsWith('/api/cards')) return handleCards(req, res, req.userSession);
                if (requestUrl.startsWith('/api/recipients')) return handleRecipients(req, res, req.userSession);
                if (requestUrl.startsWith('/api/transfers')) return handleTransfers(req, res, req.userSession);
                if (requestUrl.startsWith('/api/services')) return handleServices(req, res, req.userSession);
                if (requestUrl.startsWith('/api/stats') || requestUrl.startsWith('/api/balance') || requestUrl.startsWith('/api/home') || requestUrl.startsWith('/api/topup')) return handleStats(req, res, req.userSession);

                if (!res.headersSent) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: `Endpoint non trouvé : ${req.method} ${req.url}` }));
                }
            } catch (err) {
                logger.error('API middleware error', err);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Erreur interne' }));
                }
            }
            return;
        }

    // ================= HTML PAGES =================

    // Normalisation du chemin : suppression du slash final pour éviter les doublons
    let cleanPath = requestUrl.split('?')[0].replace(/\/$/, '') || '/';
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.token;
    
    let userSession = null;
    try {
        if (token) {
            userSession = jwt.verify(token, JWT_SECRET);
        }
    } catch (e) {
        // Token invalide ou expiré
    }

    const publicPages = ['/login.html', '/inscription.html', '/resetpassword.html', '/createnewpwd.html', '/newpass-confirm.html'];

    if (!publicPages.includes(cleanPath) && !userSession) {
        res.writeHead(302, { Location: '/login.html' });
        return res.end();
    }

    // Alias & case-insensitive mapping
    let pageName = cleanPath === '/' ? 'index.html' : (cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath);
    if (!pageName.endsWith('.html')) pageName += '.html';

    const aliases = {
        'home.html': 'index.html',
        'home': 'index.html',
        'bill.html': 'bill.html',
        'bill': 'bill.html',
        'transfer-bank.html': 'transferbybank.html',
        'transfer-bank': 'transferbybank.html'
    };

    const lowerPageName = pageName.toLowerCase();
    if (aliases[lowerPageName] && aliases[lowerPageName] !== pageName) {
        logger.info('Page alias redirect', { from: pageName, to: aliases[lowerPageName] });
        res.writeHead(302, { Location: '/' + aliases[lowerPageName] });
        return res.end();
    }

    // Les pages HTML du frontend sont maintenant dans public/Pages
    const pagesDir = path.join(__dirname, 'public', 'Pages');
    const filePath = path.join(pagesDir, pageName);
    if (!filePath.startsWith(pagesDir + path.sep)) {
        res.writeHead(403);
        return res.end('Accès interdit');
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            logger.error('Page not found', { path: filePath, pageName });
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(`<h1>404 - Page introuvable: ${pageName}</h1><p><a href="/index.html">Retour accueil</a></p>`);
        }

        setSecurityHeaders(res);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
        const duration = Date.now() - startTime;
        logger.logRequest(method, requestUrl, 200, duration);
    });
});

// ================= START SERVER =================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info('Budget_App Server démarré');
    logger.info(`Server running on http://localhost:${PORT}`);
    
});
