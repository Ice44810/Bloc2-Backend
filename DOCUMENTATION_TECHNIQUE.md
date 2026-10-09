# Documentation technique Bloc 2 — Node.js natif

Dossier : `Budget_App/Backend/`

**À retenir pour l’oral :** ce backend est écrit en **Node.js sans framework** (module `http`), pas en Express.

Le serveur fait deux choses dans le même processus :
1. il sert les **pages HTML** du Bloc 1 (copiées dans `public/Pages/`) ;
2. il répond à une **API JSON** (`/api/...`) que ces pages appellent.

Installation et lancement : [README.md](./README.md).  
Tester l’API à la main : [Postman_API_QuickStart.md](./Postman_API_QuickStart.md).  
Détail des relations entre tables : [Docs/RELATIONS_ENTITES.md](../Docs/RELATIONS_ENTITES.md).  
Mémo des sigles : à la fin de ce fichier.

---

## 1. Pourquoi Node natif après les maquettes ?

| On voulait | Comment le Bloc 2 le fait |
|------------|---------------------------|
| Comprendre une requête HTTP | `server.js` lit l’URL et la méthode, puis choisit quoi faire (routage écrit à la main). |
| De vraies données | MySQL, tables créées au démarrage par `utils/db.js`. |
| Une vraie connexion | Mot de passe haché (bcrypt), jeton JWT dans un cookie. |
| Que chacun ne voie que ses données | Chaque requête SQL filtre sur l’`user_id` du jeton. |
| Garder les écrans du Bloc 1 | Les pages sont reprises telles quelles ; leurs simulations sont remplacées par des appels à l’API. |

Express aurait été plus rapide à écrire. Le but ici était d’apprendre le protocole HTTP.

---

## 2. Choix d’outils (version simple)

| Quoi | Choix | En une phrase |
|------|--------|----------------|
| Langage serveur | Node.js 20 | JavaScript côté serveur. |
| Serveur HTTP | module `http` natif | Pas de framework : routes, fichiers statiques et lecture du corps écrits à la main. |
| Base | MySQL (paquet `mysql`) | Requêtes préparées avec `?`. |
| Connexion | JWT (`jsonwebtoken`), 7 jours | Jeton signé, rangé dans un cookie `httpOnly`. |
| Mot de passe | `bcrypt`, coût 12 | On stocke une empreinte, jamais le mot de passe. |
| Secrets | `dotenv` + fichier `.env` | Mot de passe MySQL et clé JWT hors du code et hors de Git. |
| Pages | HTML + Bootstrap 5.3 | Les ~40 écrans du Bloc 1. |
| Appels au serveur | `fetch` dans `public/js/api.js` | Un seul fichier pour parler à l’API. |
| Paiement | **aucun prestataire** | Payer = écrire une dépense en base. |

---

## 3. Organisation : le trajet d’une requête

```
Navigateur
  public/Pages/topup.html          la page appelle api.topup(50)
        │
  public/js/api.js                 fetch POST /api/topup  {"amount":50}  + cookie
        ▼
server.js                          1. lit le corps (middleware/parseBody.js)
                                   2. vérifie le JWT (sinon 401)
                                   3. choisit le handler selon l’URL
        ▼
handlers/stats.js                  règle métier : montant > 0, INSERT de la recharge
        ▼
utils/db.js → MySQL
        ▲
réponse JSON {success, balance}  → la page affiche le succès
```

| Dossier / fichier | Rôle |
|-------------------|------|
| `server.js` | Point d’entrée. Fichiers statiques, inscription / connexion / déconnexion, vérification du JWT, aiguillage vers les handlers, pages HTML. |
| `handlers/` | Le métier, un fichier par sujet : `transactions`, `categories`, `cards`, `recipients`, `transfers`, `services` (factures), `stats` (solde, accueil, recharge), `users` (profil, mots de passe). |
| `models/` | Classes `User`, `Transaction`, `Category` avec `validate()` (titre requis, montant positif, type valide…). |
| `middleware/parseBody.js` | Lit le corps de la requête (JSON ou formulaire). |
| `utils/db.js` | Connexion MySQL, création des tables, index et clés étrangères. |
| `utils/logger.js` | Logs dans la console et dans `logs/app-<date>.log`. |
| `public/Pages/` | Les pages HTML servies au navigateur. |
| `public/js/api.js` | Client de l’API (voir section 7). |

---

## 4. Base de données

### MCD (qui est lié à qui)

```
                    ┌──────────┐
                    │  users   │
                    └────┬─────┘
       1,N ┌─────────────┼──────────────┬───────────────┐ 1,N
           ▼             ▼              ▼               ▼
      ┌─────────┐  ┌────────────┐  ┌──────────┐  ┌──────────────┐
      │  cards  │  │ categories │  │recipients│  │ transactions │
      └─────────┘  └─────┬──────┘  └──────────┘  └──────▲───────┘
                         │ 0,1                          │ N
                         └──────────────────────────────┘
                     une transaction a 0 ou 1 catégorie
```

### Les 5 tables (MLD simplifié)

| Table | Colonnes utiles | Remarque |
|-------|-----------------|----------|
| `users` | id, fullName, email (unique), password (haché), role (`user` / `admin`), phone, address, postcode, ville, iban, bic_swift, bank_name, created_at | La colonne `balance` existe encore mais **n’est pas utilisée** : le solde est calculé. |
| `transactions` | id, **user_id**, title, amount, type (`income` / `expense`), **category_id** (peut être vide), created_at | Recharges, transferts et factures sont tous des transactions. |
| `categories` | id, name, **user_id** | Chaque utilisateur a ses propres catégories. |
| `cards` | id, **user_id**, card_holder_name, last_4_digits, expiry_date (`AAAA-MM`), card_brand, created_at | Jamais le numéro complet, jamais le CVV. |
| `recipients` | id, **user_id**, name, identifier, type (`phone` / `bank`), created_at | Le carnet de contacts. |

### Relations (clés étrangères)

| Lien | Règle à la suppression | Pourquoi |
|------|------------------------|----------|
| cards, categories, recipients, transactions → `users` | `ON DELETE CASCADE` | Ces lignes n’ont pas de sens sans leur propriétaire (clôture de compte, RGPD). |
| transactions → `categories` | `ON DELETE SET NULL` | La dépense reste, elle devient juste « sans catégorie ». |

En plus, l’API **refuse** de supprimer une catégorie encore utilisée par des transactions.

### Règle du solde

```
solde = SUM(montants income) − SUM(montants expense)   pour l’utilisateur connecté
```

Une seule source de vérité : toute opération (recharge, transfert, facture) est une transaction, et le solde est recalculé à chaque lecture.

---

## 5. Connexion (JWT)

```
Navigateur                         Serveur                         MySQL
    │  POST /login {email, mdp}       │                               │
    │ ───────────────────────────────▶│  SELECT user WHERE email = ?  │
    │                                 │ ─────────────────────────────▶│
    │                                 │  bcrypt.compare(mdp, hash)    │
    │  200 + cookie token (httpOnly)  │                               │
    │ ◀───────────────────────────────│  jwt.sign({userId, role}, 7j) │
    │                                 │                               │
    │  GET /api/home (cookie envoyé)  │                               │
    │ ───────────────────────────────▶│  jwt.verify → userId          │
    │  200 {balance, username…}       │  requêtes WHERE user_id = ?   │
    │ ◀───────────────────────────────│                               │
```

- Le cookie est `httpOnly` (le JavaScript de la page ne peut pas le lire) et `SameSite=strict` (protection contre les faux formulaires venant d’un autre site).
- L’API accepte aussi l’en-tête `Authorization: Bearer <jeton>`, pratique pour Postman.
- Sans jeton valide : **401**. `api.js` renvoie alors l’utilisateur vers `login.html`.
- Les pages HTML aussi sont protégées : sans jeton, redirection vers la connexion. Seules `login`, `inscription`, `resetpassword`, `createnewpwd` et `newpass-confirm` sont publiques.
- `GET /logout` efface le cookie.

**On ne fait jamais confiance à un `user_id` envoyé par le navigateur** : l’identité vient toujours du jeton.

---

## 6. Liste des routes

Toutes les routes `/api/...` demandent d’être connecté, sauf les deux routes du mot de passe oublié.

| Méthode | Route | Rôle |
|---------|-------|------|
| POST | `/register` | Inscription (409 si l’email existe déjà). |
| POST | `/login` | Connexion, pose le cookie. |
| GET | `/logout` | Déconnexion. |
| GET | `/api/home` | Accueil : nom, solde, 5 dernières transactions. |
| GET | `/api/balance` | Solde. |
| POST | `/api/topup` | Recharge (crée un revenu « Recharge »). |
| GET / POST | `/api/transactions` | Lister (filtres type, période, catégorie) / créer. |
| GET / PUT / DELETE | `/api/transactions/:id` | Lire / modifier / supprimer une transaction. |
| GET / POST | `/api/categories` | Lister / créer. |
| GET / PUT / DELETE | `/api/categories/:id` | Lire / renommer / supprimer (refusé si utilisée). |
| GET / POST | `/api/cards` | Lister / ajouter une carte (contrôle de Luhn). |
| GET / PUT / DELETE | `/api/cards/:id` | Lire / modifier / supprimer une carte. |
| GET / POST | `/api/recipients` | Lister / ajouter un contact. |
| GET / PUT / DELETE | `/api/recipients/:id` | Lire / modifier / supprimer un contact. |
| POST | `/api/transfers/p2p` | Transfert vers un contact ou un compte saisi. |
| GET | `/api/services` | Liste des services de facturation (simulés). |
| POST | `/api/services/pay/:id` | Payer une facture. |
| GET / PUT | `/api/users/profile` | Lire / modifier son profil. |
| POST | `/api/users/change-password` | Changer son mot de passe (ancien mot de passe vérifié). |
| POST | `/api/users/reset-password` | **Public.** Demander un code de réinitialisation. |
| POST | `/api/users/reset-password-confirm` | **Public.** Code + nouveau mot de passe. |
| GET | `/api/stats`, `/api/stats/monthly`, `/api/stats/pie`, `/api/stats/line`, `/api/stats/daily_evolution` | Statistiques (totaux, par mois, par catégorie…). |
| GET | `/api/stats/rewards` | Points de récompense (1 % du solde). |
| GET | `/api/users` | Liste des utilisateurs, **admin seulement** (sinon 403). |
| POST | `/api/users/otp-generate`, `/api/users/otp-verify`, `/api/transfers/confirm/:id` | Prévues pour un code OTP / une confirmation de transfert ; **non utilisées** par les pages. |

Codes de réponse utilisés : **200** OK, **201** créé, **400** données invalides, **401** pas connecté, **403** interdit, **404** introuvable, **409** email déjà pris, **500** erreur serveur.

---

## 7. Le front branché : `public/js/api.js`

Toutes les pages chargent ce fichier. Il contient trois objets.

| Objet | Rôle | Exemple |
|-------|------|---------|
| `api` | Une méthode par route. Envoie du JSON avec le cookie, lance une erreur lisible si le serveur refuse, redirige vers la connexion sur un 401. | `await api.getCards()` |
| `UI` | Affichage : montants en euros, dates, listes de transactions et de contacts. Échappe les textes saisis par l’utilisateur avant de les afficher (anti-XSS). | `UI.loadTransactions('transactionsList')` |
| `Payment` | Paiement sur 3 pages : montant → source → confirmation. Les informations sont gardées dans `sessionStorage`, puis effacées une fois le paiement fait. | `Payment.start({kind: 'bill', …})` |

Chaque page suit le même schéma :

```js
try {
    const data = await api.getHomeData();   // attendre la réponse du serveur
    // succès : mettre à jour l’affichage
} catch (error) {
    alert(error.message);                   // refus : afficher le message du serveur
}
```

---

## 8. Fonctionnalités (côté technique, en français)

**Inscription / connexion** — email unique, mot de passe haché, jeton JWT de 7 jours.

**Accueil** — nom, solde calculé, points de récompense, 5 dernières opérations, contacts et cartes.

**Profil** — lecture et modification (nom, email, téléphone, adresse). La réponse ne contient jamais le mot de passe.

**Recharge** — ajoute un revenu ; le montant doit être positif.

**Cartes** — le numéro doit passer le contrôle de Luhn ; on ne garde que les 4 derniers chiffres, la marque (Visa, Mastercard, Amex) et la date d’expiration. Le CVV n’est jamais envoyé au serveur.

**Contacts** — un contact est soit un téléphone, soit un compte bancaire.

**Transfert** — vers un contact enregistré ou un compte saisi à la main ; montant positif et solde suffisant vérifiés par le serveur (« Solde insuffisant »). Une dépense est écrite chez l’émetteur.

**Factures** — électricité, internet, mobile, cinéma : le serveur vérifie le service, le fournisseur, le montant et le solde, puis écrit une dépense.

**Historique** — liste par mois, totaux entrées / sorties, graphique 7 jours / 30 jours / période choisie, filtre par mois. Calculé dans le navigateur à partir de `GET /api/transactions`.

**Changer son mot de passe** — l’ancien est vérifié, le nouveau doit faire 6 à 20 caractères.

**Mot de passe oublié** — le serveur génère un code à 6 chiffres, le garde haché pendant 15 minutes, et accepte 5 essais au plus. Il répond pareil que l’email existe ou non, pour ne pas révéler quels comptes existent.

---

## 9. Sécurité (récapitulatif)

| Risque | Protection |
|--------|------------|
| Vol de mots de passe en base | bcrypt coût 12 (mots de passe et codes de réinitialisation). |
| Vol du jeton par un script | Cookie `httpOnly`, jeton jamais stocké dans `localStorage`. |
| Faux formulaire venant d’un autre site (CSRF) | Cookie `SameSite=strict`. |
| Injection SQL | Requêtes préparées (`?`), jamais de concaténation de valeurs. |
| Voir les données d’un autre | `WHERE ... AND user_id = ?` avec l’id du jeton. |
| Script injecté dans un titre ou un nom (XSS) | Textes échappés avant affichage (`UI.escapeHtml`, `textContent`). |
| Lire un fichier du serveur (`/public/../.env`) | Le serveur refuse tout chemin qui sort de `public/` (403). |
| Deviner un code de réinitialisation | 5 essais maximum, expiration 15 minutes. |
| Secrets dans Git | Fichier `.env` ignoré par `.gitignore`. |
| Numéro de carte | Seuls les 4 derniers chiffres sont stockés. |

---

## 10. Tests et lancement

Pas de tests automatiques dans ce bloc. Les vérifications sont faites :
- **à la main dans le navigateur** : inscription, connexion, recharge, contact, transfert, facture, carte, historique, mots de passe ;
- **avec Postman** : chaque route, avec et sans jeton (voir [Postman_API_QuickStart.md](./Postman_API_QuickStart.md)).

```bash
cd Budget_App/Backend
npm install
npm start          # http://localhost:3000
```

Le fichier `.env` doit exister avant le démarrage (modèle dans le [README](./README.md)).

---

## 11. Limites (à dire soi-même)

- **Paiements fictifs** : aucun prestataire ; payer = écrire une dépense. Choisir « carte » comme source débite quand même le solde.
- **Transfert** : le destinataire n’est pas un utilisateur de l’app, il n’est pas crédité.
- **Code OTP des transferts** : étape visuelle, le code saisi n’est pas vérifié.
- **Mot de passe oublié** : pas d’envoi d’email ; le code est écrit dans les logs. Il est gardé en mémoire et perdu au redémarrage du serveur.
- **Pas d’écran catégories ni d’ajout manuel de dépense** dans les pages : ces routes existent, mais se testent dans Postman.
- **`/api/stats/daily_evolution`** renvoie des zéros (bug de comparaison de dates) ; l’historique fait son calcul dans le navigateur.
- **Colonne `users.balance`** inutilisée (le solde est calculé) : reste de l’ancien schéma.
- **Fichiers non utilisés** : `middleware/auth.js` (anciennes sessions en mémoire) et d’anciens scripts dans `public/js/` (`bankhistory.js`, `charts.js`…).
- **Pas de tests automatiques.**
- **Pages statiques** : récompenses, offres, QR et connexion Google / Facebook / Apple sont des maquettes.

---

## Mémo des sigles (Bloc 2)

| Sigle / mot | Signification simple |
|-------------|----------------------|
| **API** | Le serveur renvoie des données (JSON), pas une page. |
| **JSON** | Format d’échange : `{"amount": 50}`. |
| **HTTP** | GET = lire, POST = créer, PUT = modifier, DELETE = supprimer. |
| **CRUD** | Créer, Lire, Modifier, Supprimer. |
| **Route** | Une adresse + une méthode (`POST /api/topup`). |
| **Handler** | Fichier qui traite un groupe de routes (`handlers/cards.js`). |
| **Middleware** | Étape commune à toutes les requêtes (ici : lire le corps). |
| **fetch** | Fonction du navigateur qui appelle le serveur sans recharger la page. |
| **JWT** | Jeton de connexion signé par le serveur, valable 7 jours. |
| **Cookie httpOnly** | Cookie que le JavaScript de la page ne peut pas lire. |
| **SameSite=strict** | Le cookie n’est pas envoyé depuis un autre site (anti-CSRF). |
| **bcrypt** | Calcule une empreinte du mot de passe ; on stocke l’empreinte. |
| **dotenv / .env** | Fichier des secrets, lu au démarrage, jamais sur Git. |
| **sessionStorage** | Mémoire du navigateur gardée entre les pages, effacée à la fermeture de l’onglet. |
| **MCD / MLD** | Schéma « qui est lié à qui » / les tables SQL avec leurs clés. |
| **PK / FK** | Clé primaire (identifiant) / clé étrangère (lien vers une autre table). |
| **CASCADE / SET NULL** | À la suppression du parent : supprimer les enfants / vider le lien. |
| **Luhn** | Calcul qui vérifie qu’un numéro de carte est bien formé (pas qu’elle existe). |
| **last4** | Les 4 derniers chiffres de la carte. |
| **P2P** | Transfert d’une personne à une autre. |
| **OTP** | Code temporaire à usage unique. |
| **XSS** | Script malveillant injecté dans une page. |
| **CSRF** | Faux formulaire envoyé depuis un autre site à votre place. |
| **401 / 403** | Pas connecté / connecté mais pas le droit. |
