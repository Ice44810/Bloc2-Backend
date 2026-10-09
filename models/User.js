/**
 * Classe User - Modèle pour la gestion des utilisateurs
 * Implémente les concepts de la Programmation Orientée Objet (POO)
 */
class User {
    constructor(data = {}) {
        this.id = data.id || null;
        this.email = data.email || '';
        this.password = data.password || '';
        this.role = data.role || 'user';
        this.fullName = data.fullName || null;
        this.phone = data.phone || null;
        this.address = data.address || null;
        this.postcode = data.postcode || null;
this.ville = data.ville || null;
        this.avatar = data.avatar || null;
        this.iban = data.iban || null;
        this.bicSwift = data.bic_swift || null;
        this.bankName = data.bank_name || null;
        this.balance = data.balance || 0.00;
        this.notifPrefs = data.notif_prefs || '{}';
        this.twofaEnabled = data.twofa_enabled || false;
        this.twofaSecret = data.twofa_secret || null;
        this.createdAt = data.created_at || new Date();
    }

    /**
     * Vérifie si l'utilisateur est un administrateur
     * @returns {boolean}
     */
    isAdmin() {
        return this.role === 'admin';
    }

    /**
     * Vérifie si l'utilisateur a un rôle spécifique
     * @param {string} role - Le rôle à vérifier
     * @returns {boolean}
     */
    hasRole(role) {
        return this.role === role;
    }

    /**
     * Retourne un objet utilisateur sans le mot de passe (pour l'affichage)
     * @returns {Object}
     */
toPublic() {
        return {
            id: this.id,
            email: this.email,
            role: this.role,
            fullName: this.fullName,
            phone: this.phone,
            address: this.address,
            postcode: this.postcode,
            ville: this.ville,
            avatar: this.avatar,
            iban: this.iban,
            bicSwift: this.bicSwift,
            bankName: this.bankName,
            balance: this.balance,
            notifPrefs: typeof this.notifPrefs === 'string' ? JSON.parse(this.notifPrefs) : this.notifPrefs,
            twofaEnabled: this.twofaEnabled,
            createdAt: this.createdAt
        };
    }

    /**
     * Valide les données de l'utilisateur
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validate() {
        const errors = [];

        if (!this.email || !this.email.includes('@')) {
            errors.push('Email invalide');
        }

        if (!this.password || this.password.length < 6) {
            errors.push('Le mot de passe doit contenir au moins 6 caractères');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Crée une instance User à partir d'un résultat de base de données
     * @param {Object} row - Ligne de résultat MySQL
     * @returns {User}
     */
    static fromRow(row) {
        return new User({
            id: row.id,
            email: row.email,
            password: row.password,
            role: row.role,
fullName: row.fullName,
            phone: row.phone,
            address: row.address,
            postcode: row.postcode,
            ville: row.ville,
            avatar: row.avatar,
            iban: row.iban,
            bic_swift: row.bic_swift,
            bank_name: row.bank_name,
            balance: row.balance,
            created_at: row.created_at
        });
    }
}

module.exports = User;

