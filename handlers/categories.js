const logger = require('../utils/logger');
const db = require('../utils/db');
const Category = require('../models/Category');

/**
 * Handler consolidé pour /api/categories
 * Merge routes/categories.js + controllers/categoriesController.js + services/CategoryService.js
 */
async function handleCategories(req, res, userSession) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;

    try {
        // GET /api/categories/:id
        const categoryIdMatch = path.match(/^\/api\/categories\/(\d+)$/);
        if (categoryIdMatch) {
            const categoryId = parseInt(categoryIdMatch[1]);
            if (method === 'GET') {
                const category = await CategoryService.getCategoryById(categoryId, userSession.userId);
                if (!category) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ message: 'Catégorie non trouvée' }));
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(category.toJSON()));
                return;
            }
            if (method === 'PUT') {
                const result = await CategoryService.updateCategory(categoryId, userSession.userId, req.body.name);
                res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
                return;
            }
            if (method === 'DELETE') {
                const result = await CategoryService.deleteCategoryWithCheck(categoryId, userSession.userId);
                res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
                return;
            }
        }

        // GET /api/categories
        if (path === '/api/categories' && method === 'GET') {
            const categories = await CategoryService.getCategories(userSession.userId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(categories.map(c => c.toJSON())));
            return;
        }

        // POST /api/categories
        if (path === '/api/categories' && method === 'POST') {
            const result = await CategoryService.createCategory(userSession.userId, req.body.name);
            if (result.success) {
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result.category));
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: result.error }));
            }
            return;
        }

        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Méthode non autorisée' }));
    } catch (err) {
        logger.error('Categories handler error', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Erreur serveur' }));
    }
}

// CategoryService consolidé
class CategoryService {
    static getCategories(userId) {
        return new Promise((resolve, reject) => {
            db.query('SELECT * FROM categories WHERE user_id = ? ORDER BY name ASC', [userId], (err, results) => {
                if (err) return reject(err);
                resolve(results.map(row => Category.fromRow(row)));
            });
        });
    }

    static getCategoryById(categoryId, userId) {
        return new Promise((resolve, reject) => {
            db.query('SELECT * FROM categories WHERE id = ? AND user_id = ?', [categoryId, userId], (err, results) => {
                if (err) return reject(err);
                resolve(results[0] ? Category.fromRow(results[0]) : null);
            });
        });
    }

    static createCategory(userId, name) {
        return new Promise((resolve) => {
            const category = new Category({ name, user_id: userId });
            const validation = category.validate();
            if (!validation.valid) return resolve({ success: false, error: validation.errors.join(', ') });

            db.query('INSERT INTO categories (name, user_id) VALUES (?, ?)', [name, userId], (err, result) => {
                if (err) return resolve({ success: false, error: 'Erreur DB' });
                category.id = result.insertId;
                resolve({ success: true, category: category.toJSON() });
            });
        });
    }

    static updateCategory(categoryId, userId, name) {
        return new Promise((resolve) => {
            const category = new Category({ id: categoryId, name, user_id: userId });
            const validation = category.validate();
            if (!validation.valid) return resolve({ success: false, error: validation.errors.join(', ') });

            db.query('UPDATE categories SET name = ? WHERE id = ? AND user_id = ?', [name, categoryId, userId], (err, result) => {
                if (err || result.affectedRows === 0) return resolve({ success: false, error: 'Catégorie non trouvée' });
                resolve({ success: true });
            });
        });
    }

    static async deleteCategoryWithCheck(categoryId, userId) {
        // Check transactions count
        const count = await new Promise(r => db.query('SELECT COUNT(*) as count FROM transactions WHERE category_id = ?', [categoryId], (e, res) => r(res[0].count)));
        if (count > 0) return { success: false, error: `${count} transactions utilisent cette catégorie` };

        return new Promise((resolve) => {
            db.query('DELETE FROM categories WHERE id = ? AND user_id = ?', [categoryId, userId], (err, result) => {
                if (err || result.affectedRows === 0) return resolve({ success: false, error: 'Catégorie non trouvée' });
                resolve({ success: true });
            });
        });
    }
}

module.exports = handleCategories;

