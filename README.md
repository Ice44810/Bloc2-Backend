# Budget App - Fil Rouge 2025

Livrable documentation Bloc 2 : [DOCUMENTATION_TECHNIQUE.md](./DOCUMENTATION_TECHNIQUE.md) (schémas, MCD, UML, fonctionnalités).  
Guide Postman : [Postman_API_QuickStart.md](./Postman_API_QuickStart.md).

**Budget App** est une application web de gestion de finances personnelles, pensée "Mobile-First". Elle permet de suivre son solde et ses dépenses, gérer ses cartes bancaires et ses contacts, effectuer des transferts et payer des factures (paiements simulés).

Ce projet a été développé dans le cadre de mon projet **Fil Rouge** de formation. Ce dossier est le **Bloc 2** : un serveur Node.js écrit sans framework, qui sert les pages du Frontend (Bloc 1) et les branche sur une API JSON.

---

## Fonctionnalités Principales

- **Compte** : inscription, connexion, déconnexion, modification du profil, changement de mot de passe, mot de passe oublié (code à 6 chiffres).
- **Tableau de bord** : nom, solde, points de récompense et dernières transactions de l'utilisateur connecté.
- **Recharge** : ajout d'argent sur le solde (transaction de type revenu).
- **Cartes bancaires** : ajout (vérification de Luhn), consultation et suppression. Seuls les 4 derniers chiffres sont stockés.
- **Contacts et transferts** : carnet de contacts (IBAN ou téléphone), transfert vers un contact ou vers un compte saisi à la main, avec contrôle du solde.
- **Factures** : paiement simulé des factures d'électricité, d'internet, de mobile et de cinéma, avec contrôle du solde.
- **Historique** : liste des transactions par mois, totaux entrées / sorties, graphique sur 7 jours, 30 jours ou une période choisie, filtre par mois.

Restent simulés ou non branchés : les vrais paiements (aucun prestataire), le code OTP des transferts (non vérifié), l'envoi d'email du mot de passe oublié (le code est écrit dans les logs), les pages récompenses / offres / QR (maquettes statiques) et la connexion Google / Facebook / Apple (boutons seulement).

---

## Architecture et Technologies

Architecture client-serveur : un seul processus Node.js sert à la fois les pages HTML et l'API JSON.

```text
Page HTML (public/Pages) → public/js/api.js → fetch → server.js → handlers/ → MySQL
                         ←              réponse JSON              ←
```

### Front-End (Client)
- **HTML5 / CSS3** : les pages du Bloc 1 (`Budget_App/Frontend`), copiées dans `public/Pages/`, avec leurs corrections SEO et accessibilité (title, meta description, h1, aria-label).
- **Bootstrap 5.3** et **Bootstrap Icons** : design responsive, modales, offcanvas.
- **Vanilla JavaScript** : chaque page appelle le serveur via `public/js/api.js`, qui regroupe :
  - `api.*` : une méthode par route (`api.topup(50)`, `api.getCards()`…), envoi en JSON, messages d'erreur, retour vers la connexion si la session a expiré ;
  - `UI.*` : affichage (montants, dates, listes) et échappement des textes saisis par l'utilisateur (protection XSS) ;
  - `Payment.*` : paiement réparti sur 3 pages (montant → source → confirmation), gardé dans `sessionStorage`.

### Back-End (Serveur)
- **Node.js 20** avec le module `http` natif : routage écrit à la main dans `server.js`, sans Express.
- **Authentification JWT** : jeton valable 7 jours, dans un cookie `httpOnly` et `SameSite=strict`. L'API accepte aussi l'en-tête `Authorization: Bearer` (pour Postman). Sans jeton valide : réponse 401.
- **Bcrypt** (coût 12) : les mots de passe et les codes de réinitialisation sont stockés hachés.
- **dotenv** : les secrets (base de données, clé JWT) sont lus dans un fichier `.env`, jamais commité.

### Base de données
- **MySQL** : base `Backend_node` (nom configurable dans `.env`).
- Tables : `users`, `transactions`, `categories`, `cards`, `recipients`.
- Relations : `user_id` → `users` (`ON DELETE CASCADE`) ; `transactions.category_id` → `categories` (`ON DELETE SET NULL`).
- Détail et justifications : [Docs/RELATIONS_ENTITES.md](../Docs/RELATIONS_ENTITES.md).
- Le solde n'est pas stocké : il est calculé (somme des revenus − somme des dépenses).
- Requêtes préparées (`?`) pour la protection contre les injections SQL ; chaque requête est filtrée par l'`user_id` du jeton.

---

## Structure du Projet

```text
Budget_App/Backend/
├── server.js           # Point d'entrée : serveur HTTP, routes, connexion / inscription / déconnexion, JWT
├── handlers/           # Logique métier de l'API (/api/...)
│   ├── transactions.js # Transactions (CRUD)
│   ├── categories.js   # Catégories (refuse de supprimer une catégorie utilisée)
│   ├── cards.js        # Cartes bancaires (Luhn, 4 derniers chiffres)
│   ├── recipients.js   # Contacts / bénéficiaires
│   ├── transfers.js    # Transferts (contrôle du solde)
│   ├── services.js     # Paiement des factures
│   ├── stats.js        # Solde, recharge, accueil, statistiques, récompenses
│   └── users.js        # Profil, mot de passe, mot de passe oublié
├── models/             # Classes User, Transaction, Category (validation)
├── middleware/         # Lecture du corps des requêtes (parseBody)
├── migrations/         # Scripts SQL de mise à jour du schéma
├── public/             # Fichiers servis au navigateur
│   ├── Pages/          # Les pages HTML (index.html, login.html, transfert.html…)
│   ├── assets/         # style.css et images
│   └── js/api.js       # Client JavaScript de l'API
├── utils/
│   ├── db.js           # Connexion MySQL, création des tables
│   └── logger.js       # Logs (console + logs/app-<date>.log)
├── seed-data.js        # Données de démonstration
├── .env                # Secrets locaux (non commité)
└── package.json        # Dépendances Node.js
```

---

## Installation et Lancement

1. **Base de données** : avoir un serveur MySQL qui tourne en local. Le script `utils/db.js` crée automatiquement la base et ses tables au démarrage.
2. **Configuration** : créer un fichier `.env` à la racine de `Backend/` (il est ignoré par Git) :
   ```bash
   PORT=3000
   NODE_ENV=development

   JWT_SECRET=une_longue_chaine_aleatoire

   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASS=votre_mot_de_passe_mysql
   DB_NAME=Backend_node
   ```
3. **Installer les dépendances** :
   ```bash
   npm install
   ```
4. **Démarrer le serveur** :
   ```bash
   npm start      # ou npm run dev pour relancer automatiquement (nodemon)
   ```
5. Ouvrir le navigateur sur : `http://localhost:3000` (redirection vers la page de connexion).

**Mot de passe oublié en développement** : aucun email n'est envoyé. Le code à 6 chiffres apparaît dans la console du serveur et dans `logs/app-<date>.log`.

---

## Vanilla JavaScript

Fait référence à l'utilisation native de JavaScript sans recourir à des bibliothèques ou frameworks comme jQuery, React ou Angular. Il s'agit de coder directement avec les API du navigateur, comme `document.querySelector`, `fetch` ou `addEventListener`.

# Bloc2-Budget_App
