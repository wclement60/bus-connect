# Système d'Alertes Prioritaires Urgentes

## Vue d'ensemble

Le système d'alertes prioritaires urgentes permet aux administrateurs d'envoyer des notifications critiques aux utilisateurs avec un système d'appel et de tchat intégré. Les alertes apparaissent dans une navbar rouge en haut de l'application.

## Fonctionnalités

### 🚨 Alertes Prioritaires
- **Navbar rouge d'alerte** : Affichage en haut de toutes les pages
- **Types d'alertes** : Erreur, Avertissement, Violation, Suspension
- **Niveaux de sévérité** : Faible, Moyenne, Élevée, Critique
- **Système d'acquittement** : Les utilisateurs peuvent marquer les alertes comme vues
- **Rotation automatique** : Si plusieurs alertes, elles défilent automatiquement

### ⚖️ Système d'Appel
- **Contestation** : Les utilisateurs peuvent faire appel des alertes
- **Formulaire détaillé** : Raison de l'appel et informations supplémentaires
- **Statuts d'appel** : En attente, En révision, Approuvé, Rejeté
- **Traitement admin** : Les administrateurs peuvent approuver ou rejeter les appels

### 💬 Système de Tchat
- **Communication temps réel** : Échange entre utilisateur et administration
- **Messages persistants** : Historique complet des conversations
- **Indicateurs de lecture** : Suivi des messages lus/non lus
- **Interface moderne** : Bulles de discussion avec avatars

## Architecture

### Base de données

#### Tables principales
```sql
-- Alertes prioritaires
priority_alerts (
  id, user_id, alert_type, title, message, severity,
  is_active, can_appeal, created_by, created_at,
  expires_at, acknowledged_at, resolved_at, metadata
)

-- Appels d'alertes
alert_appeals (
  id, alert_id, user_id, reason, additional_info,
  status, reviewed_by, reviewed_at, admin_response
)

-- Messages de tchat
alert_appeal_messages (
  id, appeal_id, sender_id, message, message_type,
  is_admin, read_by_user, read_by_admin, created_at
)
```

#### Fonctions SQL
- `get_user_active_alerts(user_id)` : Récupère les alertes actives d'un utilisateur
- `create_priority_alert()` : Crée une nouvelle alerte prioritaire

### Composants React

#### Frontend utilisateur
- **`PriorityAlertBanner`** : Navbar d'alerte rouge avec animations
- **`UserAlerts`** : Page de gestion des alertes personnelles
- **`AppealChatModal`** : Interface de tchat pour les appels

#### Interface admin
- **`PriorityAlertAdmin`** : Gestion complète des alertes et appels
- Route admin : `/admin/priority-alerts`

### Services
- **`priorityAlertService.js`** : API complète pour les alertes, appels et tchat

## Installation

### 1. Exécuter la migration SQL
```sql
-- Exécuter le fichier de migration
\i supabase/migrations/20250118_create_priority_alerts_system.sql
```

### 2. Vérifier les permissions
```sql
-- Vérifier que les politiques RLS sont actives
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('priority_alerts', 'alert_appeals', 'alert_appeal_messages');
```

## Utilisation

### Pour les administrateurs

#### Créer une alerte
1. Aller dans `/admin/priority-alerts`
2. Cliquer sur "Créer une alerte"
3. Rechercher l'utilisateur concerné
4. Définir le type, la sévérité et le message
5. Activer/désactiver la possibilité d'appel

#### Traiter un appel
1. Dans l'onglet "Appels", cliquer sur l'icône œil
2. Lire les détails de l'appel
3. Rédiger une réponse administrative
4. Approuver ou rejeter l'appel

#### Utiliser le tchat
1. Cliquer sur l'icône de tchat dans la liste des appels
2. Échanger en temps réel avec l'utilisateur
3. Les messages sont automatiquement sauvegardés

### Pour les utilisateurs

#### Voir les alertes
- Les alertes apparaissent automatiquement en haut de l'écran
- Cliquer sur l'alerte pour voir les détails
- Utiliser le bouton ✓ pour acquitter une alerte

#### Faire appel
1. Dans le modal d'alerte, cliquer sur "Faire appel"
2. Expliquer les raisons de la contestation
3. Ajouter des informations supplémentaires si nécessaire
4. Suivre l'évolution dans `/my-alerts`

#### Utiliser le tchat
1. Aller sur `/my-alerts`
2. Dans l'onglet "Mes appels", cliquer sur l'icône tchat
3. Communiquer directement avec l'administration

## Personnalisation

### Couleurs par sévérité
- **Critique** : Rouge foncé (`bg-red-600`)
- **Élevée** : Rouge (`bg-red-500`)
- **Moyenne** : Orange (`bg-orange-500`)
- **Faible** : Jaune (`bg-yellow-500`)

### Types d'alertes
- **error** : Erreur signalée
- **warning** : Avertissement
- **violation** : Violation des règles
- **suspension** : Suspension de compte

### Animations
- Apparition en slide-down
- Rotation automatique des alertes multiples
- Animations de pulsation pour les icônes

## Sécurité

### Row Level Security (RLS)
- Les utilisateurs ne voient que leurs propres alertes
- Les administrateurs ont accès à toutes les données
- Vérification des permissions sur chaque opération

### Validation
- Validation côté client et serveur
- Échappement des caractères spéciaux
- Limitation de la taille des messages

## Performance

### Optimisations
- Index sur les colonnes fréquemment requêtées
- Mise en cache des alertes actives
- Polling intelligent pour le tchat (3 secondes)

### Surveillance
- Logs des actions administratives
- Statistiques d'utilisation des alertes
- Métriques de résolution des appels

## Maintenance

### Nettoyage automatique
- Les alertes expirées sont automatiquement désactivées
- Les messages anciens peuvent être archivés
- Purge périodique des données obsolètes

### Monitoring
- Surveiller le nombre d'alertes actives
- Vérifier les temps de réponse des appels
- Analyser l'efficacité du système

## Intégration

Le système s'intègre parfaitement avec :
- **Système d'authentification** : Utilise le contexte Auth existant
- **Système de notifications** : Compatible avec les toasts
- **Thème sombre** : Support complet du mode sombre
- **Forum** : Peut être lié aux sanctions du forum

## API Endpoints

### Alertes
- `getUserActiveAlerts()` : Récupère les alertes actives
- `createPriorityAlert(data)` : Crée une alerte
- `acknowledgeAlert(id)` : Acquitte une alerte
- `resolveAlert(id)` : Résout une alerte

### Appels
- `createAppeal(alertId, data)` : Crée un appel
- `processAppeal(id, decision, response)` : Traite un appel
- `getUserAppeals()` : Récupère les appels d'un utilisateur

### Tchat
- `getAppealMessages(appealId)` : Récupère les messages
- `sendAppealMessage(appealId, message)` : Envoie un message
- `markMessagesAsRead(appealId, isAdmin)` : Marque comme lu

## Support

Pour toute question ou problème :
1. Vérifiez les logs de la console
2. Contrôlez les permissions RLS
3. Testez les fonctions SQL directement
4. Consultez la documentation Supabase pour les détails avancés

## Changelog

### Version 1.0.0
- ✅ Système d'alertes prioritaires complet
- ✅ Interface admin intuitive
- ✅ Système d'appel avec tchat
- ✅ Support du thème sombre
- ✅ Responsive design
- ✅ Animations et UX moderne 