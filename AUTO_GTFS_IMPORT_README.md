# Import GTFS Automatique

Ce système permet d'automatiser la mise à jour des données GTFS toutes les 24h (ou selon un intervalle personnalisé) en utilisant l'API transport.data.gouv.fr.

## 🚀 Fonctionnalités

- ✅ Import automatique des données GTFS depuis transport.data.gouv.fr
- ✅ Configuration par réseau de transport
- ✅ Vérification intelligente des mises à jour (évite les imports inutiles)
- ✅ Interface admin pour la gestion des configurations
- ✅ Logs détaillés des opérations
- ✅ Import manuel à la demande
- ✅ Nettoyage automatique des anciennes données

## 📋 Configuration

### 1. Déployer les migrations

Appliquez les migrations pour créer les tables nécessaires :

```sql
-- Tables de configuration et logs
supabase/migrations/20250125_create_gtfs_import_configs.sql
supabase/migrations/20250125_create_gtfs_cron_logs.sql
```

### 2. Déployer les fonctions Edge Functions

```bash
# Fonction d'import automatique
supabase functions deploy auto-gtfs-import

# Fonction cron pour automatisation
supabase functions deploy cron-gtfs-import
```

### 3. Configurer les variables d'environnement

Assurez-vous que ces variables sont définies dans votre environnement Supabase :

```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Configurer la tâche cron

Vous pouvez configurer l'exécution automatique de plusieurs façons :

#### Option A: Cron externe (recommandé)
Configurez un cron sur votre serveur pour appeler la fonction toutes les 24h :

```bash
# Ajouter à votre crontab
0 2 * * * curl -X POST "https://your-project.supabase.co/functions/v1/cron-gtfs-import" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

#### Option B: Service de monitoring (Uptime Robot, etc.)
Configurez un service de monitoring pour appeler l'URL de la fonction cron toutes les 24h.

#### Option C: GitHub Actions (pour les projets GitHub)
Créez un workflow GitHub Actions :

```yaml
name: GTFS Auto Import
on:
  schedule:
    - cron: '0 2 * * *'  # Tous les jours à 2h du matin
  workflow_dispatch:

jobs:
  import-gtfs:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger GTFS Import
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/cron-gtfs-import" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json"
```

## 🎯 Utilisation

### 1. Accéder à l'interface admin

Rendez-vous sur `/admin/auto-gtfs-import` dans votre interface d'administration.

### 2. Ajouter une configuration

Cliquez sur "Ajouter une configuration" et remplissez :

- **Network ID** : Identifiant unique de votre réseau (ex: `le-bus-esterel`)
- **URL API** : URL de l'API transport.data.gouv.fr (ex: `https://transport.data.gouv.fr/api/datasets/66f2e97fc41001275c716d9f`)
- **Dataset ID** : ID du dataset (ex: `66f2e97fc41001275c716d9f`)
- **Resource ID** : ID de la ressource GTFS (ex: `82294`)
- **Intervalle** : Nombre d'heures entre les imports (par défaut 24h)
- **Activer l'import automatique** : Cochez pour activer

### 3. Exemple de configuration pour "Le Bus" (Estérel Côte d'Azur)

```
Network ID: le-bus-esterel
URL API: https://transport.data.gouv.fr/api/datasets/66f2e97fc41001275c716d9f
Dataset ID: 66f2e97fc41001275c716d9f
Resource ID: 82294
Intervalle: 24 heures
Auto-import: ✅ Activé
```

## 🔍 Comment trouver les IDs pour votre réseau

### 1. Rechercher votre réseau sur transport.data.gouv.fr

Allez sur [transport.data.gouv.fr](https://transport.data.gouv.fr) et recherchez votre réseau.

### 2. Récupérer l'URL de l'API

Une fois sur la page de votre dataset, l'URL sera de la forme :
```
https://transport.data.gouv.fr/datasets/[slug-du-dataset]
```

L'URL de l'API sera :
```
https://transport.data.gouv.fr/api/datasets/[DATASET_ID]
```

### 3. Trouver le Resource ID

Dans la réponse JSON de l'API, cherchez la ressource avec `"format": "GTFS"` et notez son `id`.

### Exemple avec l'API

```bash
# Récupérer les informations du dataset
curl "https://transport.data.gouv.fr/api/datasets/66f2e97fc41001275c716d9f" | jq '.'

# Extraire les ressources GTFS
curl "https://transport.data.gouv.fr/api/datasets/66f2e97fc41001275c716d9f" | jq '.resources[] | select(.format == "GTFS")'
```

## 📊 Monitoring et logs

### Visualiser les logs

Les logs des exécutions cron sont stockés dans la table `gtfs_cron_logs` :

```sql
-- Voir les dernières exécutions
SELECT 
    timestamp,
    total_configs,
    success_count,
    error_count,
    results
FROM gtfs_cron_logs 
ORDER BY timestamp DESC 
LIMIT 10;

-- Voir les erreurs récentes
SELECT 
    timestamp,
    results
FROM gtfs_cron_logs 
WHERE error_count > 0 
ORDER BY timestamp DESC;
```

### Statut des configurations

```sql
-- Voir l'état de toutes les configurations
SELECT 
    network_id,
    auto_import_enabled,
    last_import_date,
    import_interval_hours,
    EXTRACT(EPOCH FROM (NOW() - last_import_date))/3600 as hours_since_last_import
FROM gtfs_import_configs
ORDER BY last_import_date DESC;
```

## 🛠️ Maintenance

### Nettoyage des logs anciens

Exécutez périodiquement pour nettoyer les logs de plus de 90 jours :

```sql
SELECT cleanup_old_gtfs_cron_logs();
```

### Désactiver temporairement l'import automatique

```sql
-- Désactiver pour un réseau spécifique
UPDATE gtfs_import_configs 
SET auto_import_enabled = false 
WHERE network_id = 'le-bus-esterel';

-- Désactiver pour tous les réseaux
UPDATE gtfs_import_configs 
SET auto_import_enabled = false;
```

## 🚨 Dépannage

### Import bloqué ou en erreur

1. Vérifiez les logs dans `gtfs_cron_logs`
2. Testez l'URL de l'API manuellement
3. Vérifiez que le Resource ID existe toujours
4. Lancez un import manuel depuis l'interface admin

### Données non mises à jour

1. Vérifiez que `auto_import_enabled = true`
2. Vérifiez l'intervalle configuré
3. Vérifiez que la tâche cron s'exécute bien
4. Vérifiez les logs d'erreur

### Performance

Si les imports sont lents :
1. Vérifiez la taille des fichiers GTFS
2. Augmentez l'intervalle entre les imports
3. Optimisez les index de base de données

## 📝 Notes importantes

- ⚠️ L'import supprime et remplace toutes les données GTFS du réseau
- 🔄 Les imports ne se lancent que si les données ont été mises à jour
- 📅 L'intervalle minimum recommandé est de 1 heure
- 💾 Les logs sont conservés 90 jours par défaut
- 🔐 Utilisez toujours la clé de service role pour les fonctions cron

## 🆘 Support

En cas de problème :
1. Consultez les logs dans l'interface admin
2. Vérifiez la console Supabase pour les erreurs des Edge Functions
3. Testez les URLs de l'API transport.data.gouv.fr manuellement 