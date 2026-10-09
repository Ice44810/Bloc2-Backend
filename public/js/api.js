/**
 * API Client - Client JavaScript pour communiquer avec le backend
 * Gère les requêtes HTTP vers l'API
 */
class APIClient {
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
    }

    /**
     * Effectuer une requête HTTP générique
     * @param {string} endpoint - Point de terminaison de l'API
     * @param {string} method - Méthode HTTP
     * @param {Object} data - Données à envoyer
     * @returns {Promise<Object>}
     */
    async request(endpoint, method = 'GET', data = null) {
        return this.send(`${this.baseUrl}${endpoint}`, method, data);
    }

    /**
     * Envoie la requête au serveur et renvoie la réponse JSON.
     * - Les données partent en JSON (le serveur les lit avec parseBody).
     * - Le token de connexion est dans un cookie httpOnly : le navigateur l'envoie
     *   tout seul grâce à credentials: 'same-origin'.
     * - Si le serveur répond 401 (token absent ou expiré), on renvoie vers la connexion.
     * - Si le serveur répond une erreur (400, 404, 500...), on lance une Error
     *   avec son message : la page l'attrape avec try/catch.
     * @param {string} url - Adresse complète (ex: '/api/cards' ou '/login')
     */
    async send(url, method = 'GET', data = null) {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin'
        };

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);

        let result = {};
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            result = await response.json();
        }

        if (response.status === 401 && url.startsWith(this.baseUrl)) {
            window.location.href = '/login.html';
            throw new Error('Session expirée, reconnectez-vous.');
        }

        if (!response.ok) {
            throw new Error(result.message || result.error || `Erreur ${response.status}`);
        }

        return result;
    }

    // ===== AUTHENTIFICATION (routes hors /api) =====

    /**
     * Créer un compte
     * @returns {Promise<Object>} - { message, userId }
     */
    async register(fullName, email, password) {
        return this.send('/register', 'POST', { fullName, email, password });
    }

    /**
     * Se connecter : le serveur pose le cookie "token" dans la réponse
     * @returns {Promise<Object>} - { success, message }
     */
    async login(email, password) {
        return this.send('/login', 'POST', { email, password });
    }

    /**
     * Se déconnecter : le serveur efface le cookie puis redirige vers login.html
     */
    logout() {
        window.location.href = '/logout';
    }

    // ===== UTILISATEURS ======

    /**
     * Obtenir le profil de l'utilisateur connecté
     * @returns {Promise<Object>}
     */
    async getProfile() {
        return this.request('/users/profile', 'GET');
    }

    /**
     * Mettre à jour le profil
     * @param {Object} data - Données du profil
     * @returns {Promise<Object>} - Résultat de la mise à jour
     */
    async updateProfile(data) {
        return this.request('/users/profile', 'PUT', data);
    }

    /**
     * Changer le mot de passe
     * @param {string} oldPassword 
     * @param {string} newPassword 
     * @returns {Promise<Object>}
     */
    async changePassword(oldPassword, newPassword) {
        return this.request('/users/change-password', 'POST', { oldPassword, newPassword });
    }

    /**
     * Demander la réinitialisation du mot de passe
     * @param {string} email 
     * @returns {Promise<Object>}
     */
    async requestPasswordReset(email) {
        return this.request('/users/reset-password', 'POST', { email });
    }

    /**
     * Réinitialiser le mot de passe avec le code reçu
     * @param {string} email 
     * @param {string} code - code à 6 chiffres
     * @param {string} newPassword 
     * @returns {Promise<Object>}
     */
    async resetPassword(email, code, newPassword) {
        return this.request('/users/reset-password-confirm', 'POST', { email, code, newPassword });
    }

    // ===== TRANSACTIONS =====

    /**
     * Obtenir toutes les transactions
     * @param {Object} filters - Filtres optionnels
     * @returns {Promise<Object[]>}
     */
    async getTransactions(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        return this.request(`/transactions?${params}`, 'GET');
    }

    /**
     * Obtenir une transaction par ID
     * @param {number} id 
     * @returns {Promise<Object>}
     */
    async getTransaction(id) {
        return this.request(`/transactions/${id}`, 'GET');
    }

    /**
     * Créer une transaction
     * @param {Object} data - Données de la transaction
     * @returns {Promise<Object>}
     */
    async createTransaction(data) {
        return this.request('/transactions', 'POST', data);
    }

    /**
     * Mettre à jour une transaction
     * @param {number} id 
     * @param {Object} data - Données à mettre à jour
     * @returns {Promise<Object>}
     */
    async updateTransaction(id, data) {
        return this.request(`/transactions/${id}`, 'PUT', data);
    }

    /**
     * Supprimer une transaction
     * @param {number} id 
     * @returns {Promise<Object>}
     */
    async deleteTransaction(id) {
        return this.request(`/transactions/${id}`, 'DELETE');
    }

    // ====== CATÉGORIES =======

    /**
     * Obtenir toutes les catégories
     * @returns {Promise<Object[]>}
     */
    async getCategories() {
        return this.request('/categories', 'GET');
    }

    /**
     * Créer une catégorie
     * @param {string} name - Nom de la catégorie
     * @returns {Promise<Object>}
     */
    async createCategory(name) {
        return this.request('/categories', 'POST', { name });
    }

    /**
     * Mettre à jour une catégorie
     * @param {number} id 
     * @param {string} name - Nouveau nom
     * @returns {Promise<Object>}
     */
    async updateCategory(id, name) {
        return this.request(`/categories/${id}`, 'PUT', { name });
    }

    /**
     * Supprimer une catégorie
     * @param {number} id 
     * @returns {Promise<Object>}
     */
    async deleteCategory(id) {
        return this.request(`/categories/${id}`, 'DELETE');
    }

    // ======= STATISTIQUES ========

    /**
     * Obtenir les statistiques globales
     * @param {Object} filters - Filtres optionnels (type, period)
     * @returns {Promise<Object>}
     */
    async getStats(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        return this.request(`/stats?${params}`, 'GET');
    }

    /**
     * Obtenir les statistiques par catégorie
     * @param {string} type - 'income' ou 'expense'
     * @param {string} period - Période
     * @returns {Promise<Object[]>}
     */
    async getCategoryStats(type = 'expense', period = 'month') {
        return this.request(`/stats/categories?type=${type}&period=${period}`, 'GET');
    }

    /**
     * Obtenir l'évolution mensuelle
     * @param {number} months 
     * @returns {Promise<Object[]>}
     */
    async getMonthlyEvolution(months = 6) {
        return this.request(`/stats/monthly?months=${months}`, 'GET');
    }

    /**
     * Obtenir le graphique en secteurs
     * @param {string} type 
     * @returns {Promise<Object>}
     */
    async getPieChartData(type = 'expense') {
        return this.request(`/stats/pie?type=${type}`, 'GET');
    }

    /**
     * Obtenir les données du graphique linéaire
     * @returns {Promise<Object>}
     */
    async getLineChartData() {
        return this.request('/stats/line', 'GET');
    }

    /**
     * Obtenir les points de récompense
     * @returns {Promise<Object>} - { points, level, nextLevel }
     */
    async getRewards() {
        return this.request('/stats/rewards', 'GET');
    }

    // ========== HOMEPAGE ===========

    /**
     * Obtenir les données de la page d'accueil
     * @returns {Promise<Object>} - Données globales pour l'accueil (solde, transactions récentes, etc.)
     */
    async getHomeData() {
        return this.request('/home', 'GET'); // Point de terminaison pour les données globales de l'accueil
    }

    /**
     * Obtenir le solde
     * @returns {Promise<number>}
     */
    async getBalance() {
        return this.request('/balance', 'GET');
    }

    /**
     * Effectuer un top-up/recharge
     * @param {number} amount - Montant à recharger
     * @returns {Promise<Object>}
     */
    async topup(amount) {
        return this.request('/topup', 'POST', { amount });
    }

    // =========== DESTINATAIRES =============

    /**
     * Obtenir tous les destinataires
     * @returns {Promise<Object[]>}
     */
    async getRecipients() {
        return this.request('/recipients', 'GET');
    }

    /**
     * Créer un destinataire
     * @param {Object} data - Données du destinataire
     * @returns {Promise<Object>}
     */
    async createRecipient(data) {
        return this.request('/recipients', 'POST', data);
    }

    /**
     * Supprimer un destinataire
     * @param {number} id 
     * @returns {Promise<Object>}
     */
    async deleteRecipient(id) {
        return this.request(`/recipients/${id}`, 'DELETE');
    }

    /**
     * Obtenir un destinataire
     * @param {number} id 
     */
    async getRecipient(id) {
        return this.request(`/recipients/${id}`, 'GET');
    }

    /**
     * Modifier un destinataire
     * @param {number} id 
     * @param {Object} data - { name, identifier, type }
     */
    async updateRecipient(id, data) {
        return this.request(`/recipients/${id}`, 'PUT', data);
    }

    // =========== TRANSFERTS ET FACTURES =============

    /**
     * Envoyer de l'argent
     * @param {Object} data - { amount, title, recipient_id } ou { amount, title, recipient_name, recipient_identifier }
     */
    async transfer(data) {
        return this.request('/transfers/p2p', 'POST', data);
    }

    /**
     * Payer une facture
     * @param {number} serviceId - 1 Mobile, 2 Internet, 3 Électricité, 4 Eau, 5 Film
     * @param {number} amount 
     * @param {string} provider - ex: 'EDF'
     */
    async payService(serviceId, amount, provider) {
        return this.request(`/services/pay/${serviceId}`, 'POST', { amount, provider });
    }

    // =========== CARTES BANCAIRES =============

    /**
     * Obtenir toutes les cartes
     */
    async getCards() {
        return this.request('/cards', 'GET');
    }

    /**
     * Obtenir une carte spécifique
     */
    async getCard(id) {
        return this.request(`/cards/${id}`, 'GET');
    }

    /**
     * Ajouter une carte
     * @param {Object} data - { cardNumber, cardHolderName, expiryDate }
     */
    async createCard(data) {
        return this.request('/cards', 'POST', data);
    }

    /**
     * Supprimer une carte
     */
    async deleteCard(id) {
        return this.request(`/cards/${id}`, 'DELETE');
    }
}

// Créer une instance globale du client API
const api = new APIClient();

/**
 * Paiement en cours (transfert ou facture).
 * Un paiement se fait sur plusieurs pages : montant -> source de paiement -> confirmation.
 * On garde donc ses informations dans sessionStorage, qui survit au changement de page
 * (mais disparaît quand on ferme l'onglet).
 */
const Payment = {
    KEY: 'pending_payment',

    /**
     * Démarrer un paiement puis aller choisir la source
     * @param {Object} data - { kind: 'transfer'|'bill', amount, label, ... }
     */
    start(data) {
        sessionStorage.setItem(this.KEY, JSON.stringify(data));
        window.location.href = './paymentsource.html';
    },

    /** @returns {Object|null} le paiement en cours */
    get() {
        try {
            return JSON.parse(sessionStorage.getItem(this.KEY));
        } catch {
            return null;
        }
    },

    /** Compléter le paiement en cours (ex: la source choisie) */
    update(fields) {
        sessionStorage.setItem(this.KEY, JSON.stringify({ ...this.get(), ...fields }));
    },

    clear() {
        sessionStorage.removeItem(this.KEY);
    },

    /**
     * Exécuter le paiement auprès du serveur
     * @returns {Promise<Object>}
     */
    async execute() {
        const p = this.get();
        if (!p) throw new Error('Aucun paiement en cours');
        if (p.kind === 'bill') {
            return api.payService(p.serviceId, p.amount, p.provider);
        }
        return api.transfer({
            amount: p.amount,
            title: p.message ? `Transfert à ${p.recipientName} : ${p.message}` : `Transfert à ${p.recipientName}`,
            recipient_id: p.recipientId,
            recipient_name: p.recipientName,
            recipient_identifier: p.recipientIdentifier
        });
    }
};

// Fonctions utilitaires pour l'interface utilisateur
const UI = {
    /**
     * Afficher une notification
     * @param {string} message 
     * @param {string} type - 'success', 'error', 'warning', 'info'
     */
    showNotification(message, type = 'info') {
        // Supprimer les notifications existantes
        const existingNotifications = document.querySelectorAll('.notification-toast');
        existingNotifications.forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `notification-toast alert alert-${type} position-fixed top-0 end-0 m-3`;
        notification.style.zIndex = '9999';
        notification.textContent = message;

        document.body.appendChild(notification);

        // Supprimer après 3 secondes
        setTimeout(() => {
            notification.remove();
        }, 3000);
    },

    /**
     * Formater un montant en euros
     * @param {number} amount 
     * @returns {string}
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    },

    /**
     * Formater une date
     * @param {string|Date} date 
     * @returns {string}
     */
    /**
     * Transformer un texte saisi ("€50", "12,5") en nombre (50, 12.5)
     * @param {string} text 
     * @returns {number} NaN si ce n'est pas un nombre
     */
    parseAmount(text) {
        return parseFloat(String(text).replace(/[^\d,.]/g, '').replace(',', '.'));
    },

    /**
     * Attendre quelques millisecondes (utile entre deux modals Bootstrap)
     * @param {number} ms 
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Initiales d'un nom ("Alex Tran" -> "AT"), pour remplacer une photo
     * @param {string} name 
     */
    initials(name) {
        return String(name || '?').split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase();
    },

    /**
     * Construire le HTML d'un contact (onglets Téléphone / Compte bancaire)
     * @param {Object} recipient - { id, name, identifier, type }
     */
    recipientItemHtml(recipient) {
        return `
            <a href="./detailcontact.html?id=${recipient.id}" class="contact-item d-flex align-items-center mb-3 text-decoration-none text-dark">
                <div class="rounded-circle bg-primary-subtle text-primary fw-bold d-flex align-items-center justify-content-center me-3"
                    style="width: 50px; height: 50px;" aria-hidden="true">${UI.escapeHtml(UI.initials(recipient.name))}</div>
                <div>
                    <strong>${UI.escapeHtml(recipient.name)}</strong><br />
                    <small class="text-muted">${UI.escapeHtml(recipient.identifier)}</small>
                </div>
            </a>
        `;
    },

    /**
     * Charger les contacts dans les onglets #phone et #bank, avec recherche
     * @param {string} phoneId - id du conteneur des contacts téléphone
     * @param {string} bankId - id du conteneur des comptes bancaires
     * @param {string} searchInputId - id du champ de recherche (optionnel)
     */
    async loadRecipients(phoneId, bankId, searchInputId) {
        const phoneEl = document.getElementById(phoneId);
        const bankEl = document.getElementById(bankId);
        let recipients = [];

        const render = () => {
            const search = searchInputId ? document.getElementById(searchInputId).value.trim().toLowerCase() : '';
            const visible = recipients.filter(r => r.name.toLowerCase().includes(search) || r.identifier.toLowerCase().includes(search));
            const empty = '<p class="text-muted text-center">Aucun contact. <a href="./addnewrecipient.html">Ajouter</a></p>';
            const phones = visible.filter(r => r.type === 'phone');
            const banks = visible.filter(r => r.type === 'bank');
            phoneEl.innerHTML = phones.length ? phones.map(UI.recipientItemHtml).join('') : empty;
            bankEl.innerHTML = banks.length ? banks.map(UI.recipientItemHtml).join('') : empty;
        };

        try {
            recipients = await api.getRecipients();
            render();
            if (searchInputId) {
                document.getElementById(searchInputId).addEventListener('input', render);
            }
        } catch (error) {
            console.error('Erreur chargement contacts:', error);
            phoneEl.innerHTML = bankEl.innerHTML = '<p class="text-danger">Erreur lors du chargement</p>';
        }
    },

    formatDate(date) {
        return new Date(date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    },

    /**
     * Formater une date relative (aujourd'hui, hier, il y a X jours)
     * @param {string|Date} date 
     * @returns {string}
     */
    formatRelativeDate(date) {
        const now = new Date();
        const transactionDate = new Date(date);
        const diffMs = now - transactionDate;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Aujourd\'hui';
        if (diffDays === 1) return 'Hier';
        if (diffDays < 7) return `Il y a ${diffDays} jours`;
        
        return this.formatDate(date);
    },

    /**
     * Protéger un texte avant de l'insérer avec innerHTML.
     * Sans ça, un titre comme "<img onerror=...>" serait exécuté par le navigateur (faille XSS).
     * @param {string} text
     * @returns {string}
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    },

    /**
     * Choisir une icône Bootstrap selon le titre de la transaction
     * @param {Object} tx
     * @returns {string} - ex: 'bi-lightning-fill'
     */
    transactionIcon(tx) {
        const title = (tx.title || '').toLowerCase();
        if (title.includes('électricité') || title.includes('electricit')) return 'bi-lightning-fill';
        if (title.includes('eau')) return 'bi-droplet-fill';
        if (title.includes('internet') || title.includes('wifi')) return 'bi-wifi';
        if (title.includes('mobile')) return 'bi-phone-fill';
        if (title.includes('recharge')) return 'bi-wallet2';
        if (title.includes('transfert')) return 'bi-arrow-left-right';
        return tx.type === 'income' ? 'bi-arrow-down-left' : 'bi-arrow-up-right';
    },

    /**
     * Construire le HTML d'une ligne de transaction (même style que les maquettes)
     * @param {Object} tx - transaction renvoyée par l'API
     * @returns {string}
     */
    transactionItemHtml(tx) {
        const isIncome = tx.type === 'income';
        const date = tx.created_at ? UI.formatRelativeDate(tx.created_at) : 'Date inconnue';
        return `
            <div class="transaction-item px-3">
                <div class="d-flex align-items-center">
                    <div class="p-2 me-3 rounded-circle ${isIncome ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}">
                        <i class="bi ${UI.transactionIcon(tx)}" aria-hidden="true"></i>
                    </div>
                    <div>
                        <p class="fw-medium text-dark mb-0">${UI.escapeHtml(tx.title)}</p>
                        <p class="small text-muted mb-0">${UI.escapeHtml(tx.category_name || 'Sans catégorie')} • ${date}</p>
                    </div>
                </div>
                <p class="fs-6 fw-semibold mb-0 ${isIncome ? 'text-success' : 'text-danger'}">
                    ${isIncome ? '+' : '-'} ${UI.formatCurrency(tx.amount)}
                </p>
            </div>
        `;
    },

    /**
     * Charger et afficher les transactions, regroupées par mois
     * @param {string} containerId
     * @param {Object} filters - ex: { type: 'expense', period: 'month' }
     */
    async loadTransactions(containerId, filters = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const transactions = await api.getTransactions(filters);

            if (!transactions || transactions.length === 0) {
                container.innerHTML = '<p class="text-muted text-center mb-0">Aucune transaction</p>';
                return;
            }

            // Regroupement : { "octobre 2026": [tx, tx], "septembre 2026": [tx] }
            const groups = {};
            transactions.forEach(tx => {
                const month = tx.created_at
                    ? new Date(tx.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                    : 'Date inconnue';
                if (!groups[month]) groups[month] = [];
                groups[month].push(tx);
            });

            container.innerHTML = Object.entries(groups).map(([month, list]) => `
                <div class="mb-4 px-3">
                    <h3 class="text-secondary fw-semibold mb-3 fs-6 text-capitalize">${month}</h3>
                    ${list.map(tx => UI.transactionItemHtml(tx)).join('')}
                </div>
            `).join('');
        } catch (error) {
            console.error('Erreur chargement transactions:', error);
            container.innerHTML = '<p class="text-danger mb-0">Erreur lors du chargement</p>';
        }
    },

    /**
     * Charger le solde
     * @param {string} elementId 
     */
    async loadBalance(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;

        try {
            const data = await api.getHomeData();
            element.textContent = UI.formatCurrency(data.balance);
        } catch (error) {
            console.error('Erreur chargement solde:', error);
            element.textContent = 'Erreur';
        }
    }
};

// Rendre les fonctions disponibles globalement
window.api = api;
window.UI = UI;
window.Payment = Payment;
