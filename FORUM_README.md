# Forum Bus Connect

Un système de forum complet intégré à l'application Bus Connect, permettant aux utilisateurs d'échanger sur les transports en commun.

## 🌟 Fonctionnalités

### Pour tous les utilisateurs
- **Consultation libre** : Lecture de tous les posts et réponses sans inscription
- **Navigation intuitive** : Catégories et sous-catégories organisées
- **Recherche** : Recherche de contenu dans les posts
- **Interface responsive** : Optimisée pour mobile et desktop

### Pour les utilisateurs connectés
- **Création de sujets** : Démarrer de nouvelles discussions
- **Réponses** : Participer aux conversations existantes
- **Système de likes** : Aimer les posts et réponses
- **Réponses imbriquées** : Répondre directement à un message
- **Édition** : Modifier ses propres posts et réponses

### Pour les administrateurs (modtools = 1)
- **Gestion des catégories** : Créer, modifier, supprimer les catégories et sous-catégories
- **Modération** : Épingler, verrouiller, supprimer les posts
- **Administration complète** : Interface dédiée dans l'espace admin
- **Statistiques** : Vue d'ensemble de l'activité du forum

## 🚀 Installation

### 1. Mise en place de la base de données

Exécutez les scripts SQL suivants dans Supabase (dans l'ordre) :

```sql
-- 1. Créer les tables principales
\i 'supabase/migrations/create_forum_tables.sql'

-- 2. Ajouter les fonctions et vues
\i 'supabase/migrations/add_forum_functions.sql'
```

### 2. Vérification des permissions

Assurez-vous que votre utilisateur admin a `modtools = 1` :

```sql
UPDATE public.users SET modtools = 1 WHERE email = 'votre-email@example.com';
```

### 3. Interface

Le forum est automatiquement intégré dans l'application :
- **Page publique** : `/forum`
- **Administration** : `/admin/forum` (admins uniquement)

## 🗂️ Structure des fichiers

```
src/
├── pages/
│   ├── Forum.js                    # Page principale du forum
│   ├── ForumCategory.js            # Page d'une sous-catégorie
│   ├── ForumPost.js                # Page d'un post individuel
│   └── admin/
│       └── ForumAdmin.js           # Administration du forum
├── services/
│   └── forumService.js             # API et logique métier
└── components/
    └── BottomNavBar.js            # Navigation (lien forum ajouté)

supabase/migrations/
├── create_forum_tables.sql         # Tables principales
└── add_forum_functions.sql         # Fonctions et vues
```

## 🎯 Utilisation

### Navigation

1. **Accès au forum** : Menu → Forum ou `/forum`
2. **Parcourir les catégories** : Cliquez sur une sous-catégorie
3. **Lire un sujet** : Cliquez sur le titre d'un post
4. **Créer un sujet** : Bouton "Nouveau sujet" (connexion requise)
5. **Répondre** : Bouton "Répondre" sous un post (connexion requise)

### Administration

1. **Accès** : Menu admin → Forum ou `/admin/forum`
2. **Catégories** : Onglet "Catégories" pour gérer la structure
3. **Modération** : Onglet "Modération" pour gérer les contenus

## 🔒 Sécurité et permissions

### Row Level Security (RLS)

Toutes les tables utilisent RLS avec les politiques suivantes :

- **Lecture** : Ouverte à tous pour les contenus actifs
- **Création** : Réservée aux utilisateurs connectés
- **Modification** : Auteurs ou administrateurs uniquement
- **Suppression** : Administrateurs uniquement
- **Gestion des catégories** : Administrateurs uniquement

### Validation côté client

- Vérification de l'authentification avant les actions
- Protection des formulaires
- Gestion des erreurs utilisateur

## 📊 Base de données

### Tables principales

- `forum_categories` : Catégories principales
- `forum_subcategories` : Sous-catégories
- `forum_posts` : Sujets/posts
- `forum_replies` : Réponses aux posts
- `forum_likes` : Système de likes

### Fonctionnalités automatiques

- **Timestamps** : Création et modification automatiques
- **Compteurs** : Vues, réponses, likes
- **Triggers** : Mise à jour des dernières réponses
- **Index** : Optimisation des performances

## 🎨 Personnalisation

### Icônes de catégories

Modifiez les icônes disponibles dans `Forum.js` :

```javascript
const iconMap = {
  'chat': <ChatIcon />,
  'help': <HelpIcon />,
  'lightbulb': <IdeaIcon />,
  'newspaper': <NewsIcon />
  // Ajoutez vos icônes ici
};
```

### Styles

Le forum utilise les classes Tailwind existantes et s'adapte automatiquement au thème sombre/clair.

### Limites configurables

Dans `forumService.js`, vous pouvez modifier :

```javascript
const POSTS_PER_PAGE = 20;        // Posts par page
const REPLIES_PER_PAGE = 50;      // Réponses par page
const SEARCH_LIMIT = 20;          // Résultats de recherche
```

## 🔧 Maintenance

### Nettoyage automatique

Utilisez la fonction de nettoyage pour supprimer les anciens posts inactifs :

```sql
SELECT cleanup_old_forum_data(365); -- Supprime les posts de plus d'un an sans activité
```

### Statistiques

Obtenez les statistiques du forum :

```sql
SELECT * FROM get_forum_stats();
```

### Vues utiles

- `popular_forum_posts` : Posts populaires (>10 vues)
- `recent_forum_activity` : Activité récente (posts + réponses)

## 🐛 Dépannage

### Problèmes courants

1. **Erreur d'autorisation** : Vérifiez que `modtools = 1` pour les admins
2. **Fonction manquante** : Exécutez `add_forum_functions.sql`
3. **Performance lente** : Vérifiez que les index sont créés

### Logs et debugging

Activez les logs dans la console du navigateur pour diagnostiquer les problèmes d'API.

## 🚀 Évolutions futures

### Fonctionnalités planifiées

- [ ] Notifications push pour les réponses
- [ ] Mentions d'utilisateurs (@username)
- [ ] Pièces jointes dans les posts
- [ ] Tags et filtres avancés
- [ ] Système de badges utilisateurs
- [ ] API REST publique

### Optimisations

- [ ] Cache Redis pour les posts populaires
- [ ] Pagination infinie
- [ ] Recherche full-text avancée
- [ ] Compression d'images automatique

## 📝 Licence

Ce système de forum fait partie de l'application Bus Connect et suit la même licence.

---

**Développé pour Bus Connect** - Système de transport intelligent 