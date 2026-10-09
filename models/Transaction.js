/**
 * Classe Transaction - Modèle pour la gestion des transactions financières
 * Implémente les concepts de la Programmation Orientée Objet (POO)
 */
class Transaction {
    static TYPES = {
        INCOME: 'income',
        EXPENSE: 'expense'
    };

    constructor(data = {}) {
        this.id = data.id || null;
        this.userId = data.user_id || null;
        this.title = data.title || '';
        this.amount = parseFloat(data.amount) || 0;
        this.type = data.type || Transaction.TYPES.EXPENSE;
        this.categoryId = data.category_id || null;
        this.categoryName = data.category_name || null;
        this.createdAt = data.created_at || new Date();
    }

    /**
     * Vérifie si la transaction est un revenu
     * @returns {boolean}
     */
    isIncome() {
        return this.type === Transaction.TYPES.INCOME;
    }

    /**
     * Vérifie si la transaction est une dépense
     * @returns {boolean}
     */
    isExpense() {
        return this.type === Transaction.TYPES.EXPENSE;
    }

    /**
     * Retourne le montant signé (positif pour revenu, négatif pour dépense)
     * @returns {number}
     */
    getSignedAmount() {
        return this.isIncome() ? this.amount : -this.amount;
    }

    /**
     * Retourne le montant formaté avec le signe
     * @returns {string}
     */
    getFormattedAmount() {
        const sign = this.isIncome() ? '+' : '-';
        return `${sign}${this.amount.toFixed(2)} €`;
    }

    /**
     * Retourne un objet transaction pour l'API
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            user_id: this.userId,
            title: this.title,
            amount: this.amount,
            type: this.type,
            category_id: this.categoryId,
            category_name: this.categoryName,
            created_at: this.createdAt
        };
    }

    /**
     * Valide les données de la transaction
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validate() {
        const errors = [];

        if (!this.title || this.title.trim() === '') {
            errors.push('Le titre est requis');
        }

        if (this.amount <= 0) {
            errors.push('Le montant doit être positif');
        }

        if (!Object.values(Transaction.TYPES).includes(this.type)) {
            errors.push('Le type doit être "income" ou "expense"');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Crée une instance Transaction à partir d'un résultat de base de données
     * @param {Object} row - Ligne de résultat MySQL
     * @returns {Transaction}
     */
    static fromRow(row) {
        return new Transaction({
            id: row.id,
            user_id: row.user_id,
            title: row.title,
            amount: row.amount,
            type: row.type,
            category_id: row.category_id,
            category_name: row.category_name,
            created_at: row.created_at
        });
    }
}

module.exports = Transaction;

