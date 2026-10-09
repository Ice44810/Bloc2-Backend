/**
 * Classe Category - Modèle pour la gestion des catégories de transactions
 * Implémente les concepts de la Programmation Orientée Objet (POO)
 */
class Category {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.userId = data.user_id || null;
        this.createdAt = data.created_at || new Date();
    }

    /**
     * Retourne un objet catégorie pour l'API
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            user_id: this.userId,
            created_at: this.createdAt
        };
    }

    /**
     * Valide les données de la catégorie
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validate() {
        const errors = [];

        if (!this.name || this.name.trim() === '') {
            errors.push('Le nom de la catégorie est requis');
        }

        if (this.name.length > 255) {
            errors.push('Le nom ne peut pas dépasser 255 caractères');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Crée une instance Category à partir d'un résultat de base de données
     * @param {Object} row - Ligne de résultat MySQL
     * @returns {Category}
     */
    static fromRow(row) {
        return new Category({
            id: row.id,
            name: row.name,
            user_id: row.user_id,
            created_at: row.created_at
        });
    }
}

module.exports = Category;

