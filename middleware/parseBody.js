const { parse } = require('querystring');

/**
 * Middleware pour parser body (form ou JSON)
 */
async function parseBody(req, res, next) {
    return new Promise((resolve, reject) => {
        if (req.method === 'GET' || req.method === 'HEAD') return resolve();

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            if (body.length > 1e6) {
                reject(new Error('Request body too large'));
                req.connection.destroy();
            }
        });

        req.on('end', () => {
            try {
                // Try JSON first
                req.body = JSON.parse(body);
            } catch {
                // Fallback to querystring
                req.body = parse(body);
            }
            resolve();
        });
    });
}

module.exports = parseBody;

