# Configuration API Géolocalisation des Véhicules (BIBUS)

## Problème résolu
L'API BIBUS retourne des données avec des timestamps à "0", ce qui causait le filtrage des véhicules. Le code a été modifié pour accepter ces timestamps.

## Configuration dans Supabase

### 1. Table `networks`
Pour le réseau BIBUS, vérifiez/ajoutez ces colonnes :

```sql
-- Activer l'API de positions des véhicules GTFS-RT
UPDATE networks 
SET has_gtfs_rt_vp_api = true,
    vp_gtfs_rt_url = 'URL_DE_VOTRE_API_BIBUS',
    vp_params = '{}',  -- ou vos paramètres spécifiques si nécessaire
    vp_requires_api_key = false  -- ou true si une clé API est requise
WHERE network_id = 'VOTRE_NETWORK_ID_BIBUS';
```

### 2. Exemple de configuration complète

Si votre API est à l'URL que vous avez fournie, la configuration serait :

```sql
UPDATE networks 
SET has_gtfs_rt_vp_api = true,
    vp_gtfs_rt_url = 'https://votre-api-bibus.com/vehicle-positions',
    vp_params = '{}',
    vp_requires_api_key = false
WHERE network_id = 'bibus';  -- Remplacez par votre ID de réseau
```

### 3. Structure attendue de l'API

L'API doit retourner du JSON au format GTFS-RT Vehicle Positions :
```json
{
  "entity": [
    {
      "id": "vehicle:268435659",
      "vehicle": {
        "position": {
          "bearing": 320.0,
          "latitude": 48.41522979736328,
          "longitude": -4.487177848815918
        },
        "timestamp": "0",
        "trip": {
          "routeId": "02A",
          "tripId": "16557346"
        },
        "vehicle": {
          "id": "268435659"
        }
      }
    }
  ]
}
```

### 4. Colonnes nécessaires dans la table `networks`

Si ces colonnes n'existent pas, créez-les :

```sql
-- Ajouter les colonnes pour l'API de positions des véhicules
ALTER TABLE networks 
ADD COLUMN IF NOT EXISTS has_gtfs_rt_vp_api BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vp_gtfs_rt_url TEXT,
ADD COLUMN IF NOT EXISTS vp_params JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS vp_requires_api_key BOOLEAN DEFAULT false;
```

## Modifications apportées au code

1. **Acceptation des timestamps à "0"** : Le code accepte maintenant les véhicules avec timestamp = 0
2. **Support du JSON** : L'API peut retourner du JSON ou du protobuf binaire
3. **Extraction de l'ID** : L'ID du véhicule est correctement extrait même avec le préfixe "vehicle:"

## Vérification

Après configuration, les bus devraient apparaître sur la carte avec :
- Position en temps réel
- Direction (bearing)
- Association à la ligne et au voyage
- Possibilité de cliquer pour voir les détails

## Dépannage

Si les véhicules n'apparaissent toujours pas :
1. Vérifiez dans la console du navigateur les logs réseau
2. Assurez-vous que l'URL de l'API est accessible
3. Vérifiez que le `routeId` dans l'API correspond bien aux `route_id` dans votre base de données 