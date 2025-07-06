# Intégration des Informations de Trafic dans Bus Connect

Cette documentation explique comment intégrer les informations de trafic de l'API Oise Mobilité dans les horaires de Bus Connect.

## Vue d'ensemble

Cette fonctionnalité permet d'afficher les perturbations de trafic directement dans les pages d'horaires en utilisant l'API `https://api.oisemob.cityway.fr/disrupt/api/v1/fr/disruptions`.

## Étapes d'implémentation

### 1. Appliquer la migration SQL

Exécutez la migration SQL pour ajouter la colonne `network_code` à la table `agency` :

```bash
# Appliquer la migration localement
npx supabase migration apply --local

# Ou appliquer en production
npx supabase db push
```

Ou exécutez directement cette requête SQL :

```sql
-- Migration pour ajouter la colonne network_code à la table agency
ALTER TABLE agency ADD COLUMN IF NOT EXISTS network_code INTEGER;
COMMENT ON COLUMN agency.network_code IS 'ID du réseau dans l\'API de perturbations Oise Mobilité';
```

### 2. Configurer les network_code dans la base de données

Pour chaque réseau, vous devez configurer le `network_code` correspondant à l'API de perturbations. Voici quelques exemples :

```sql
-- Exemple de configuration pour différents réseaux
-- Remplacez les valeurs par les vrais network_id de votre base de données

-- AXO (exemple: network_code = 51)
UPDATE agency 
SET network_code = 51 
WHERE network_id = 'AXO';

-- TIC Interurbain (exemple: network_code = 49)
UPDATE agency 
SET network_code = 49 
WHERE network_id = 'TIC';

-- Autres réseaux...
-- UPDATE agency SET network_code = [ID_API] WHERE network_id = '[NETWORK_ID]';
```

### 3. Trouver les network_code corrects

Pour identifier les bons `network_code`, vous pouvez :

1. **Consulter l'API de perturbations** :
   ```bash
   curl -X GET "https://api.oisemob.cityway.fr/disrupt/api/v1/fr/disruptions" \
        -H "Accept: application/json"
   ```

2. **Rechercher dans la réponse JSON** les `networkId` correspondant à vos réseaux :
   ```json
   {
     "affectedLines": [
       {
         "networkId": 51,
         "networkName": "AXO Transport",
         "number": "B"
       }
     ]
   }
   ```

### 4. Vérifier l'intégration

Une fois configuré, l'application affichera automatiquement :

- ✅ Les perturbations actives pour chaque ligne
- ✅ Les alertes de trafic avec détails expandables
- ✅ Les types de perturbations (Travaux, Arrêt non desservi, Information)
- ✅ Les dates de début et fin des perturbations
- ✅ Rafraîchissement automatique toutes les 5 minutes

## Structure des fichiers créés/modifiés

### Nouveaux fichiers :
- `supabase/migrations/20250120_add_network_code_to_agency.sql` - Migration SQL
- `src/services/lineTrafficService.js` - Service pour les perturbations de ligne
- `src/components/Horaires/TrafficAlert.js` - Composant d'affichage des alertes

### Fichiers modifiés :
- `src/components/Horaires/Horaires.js` - Intégration du composant TrafficAlert

## API et fonctionnalités

### Service `lineTrafficService.js`

**Fonctions principales :**
- `getNetworkCode(networkId)` - Récupère le network_code depuis la DB
- `getDisruptionsForNetwork(networkCode)` - Récupère les perturbations pour un réseau
- `getDisruptionsForLine(networkId, lineNumber)` - Perturbations pour une ligne spécifique
- `getFormattedDisruptionsForLine(networkId, lineNumber)` - Perturbations formatées pour l'affichage

### Composant `TrafficAlert.js`

**Caractéristiques :**
- Affichage accordéon des alertes
- Types d'alertes colorées (rouge, orange, bleu)
- Nettoyage automatique du HTML dans les descriptions
- Affichage des lignes concernées
- Support du mode sombre

## Exemples d'utilisation

### Configuration manuelle des network_code

```sql
-- Vérifier les réseaux existants
SELECT network_id, network_name FROM networks;

-- Vérifier les agences existantes
SELECT agency_id, network_id, agency_name FROM agency;

-- Configurer les network_code (exemples)
UPDATE agency SET network_code = 51 WHERE network_id = 'AXO';
UPDATE agency SET network_code = 49 WHERE network_id = 'TIC';
UPDATE agency SET network_code = 52 WHERE network_id = 'AUTRE_RESEAU';
```

### Test de l'API

```javascript
// Tester la récupération des perturbations
import { getFormattedDisruptionsForLine } from './src/services/lineTrafficService';

// Test pour la ligne B du réseau AXO
const disruptions = await getFormattedDisruptionsForLine('AXO', 'B');
console.log('Perturbations trouvées:', disruptions);
```

## Dépannage

### Problèmes courants :

1. **Aucune perturbation affichée** :
   - Vérifiez que `network_code` est configuré dans la table `agency`
   - Vérifiez que l'API retourne des données pour ce `networkId`
   - Vérifiez les logs de la console pour les erreurs

2. **Erreur de CORS** :
   - L'API Oise Mobilité doit autoriser les requêtes depuis votre domaine
   - En développement, utilisez un proxy ou désactivez CORS temporairement

3. **Performance** :
   - Les perturbations sont mises en cache et rafraîchies toutes les 5 minutes
   - Seules les perturbations actives sont affichées

### Vérification de la configuration :

```sql
-- Vérifier la configuration des network_code
SELECT 
    a.agency_id,
    a.network_id,
    a.agency_name,
    a.network_code,
    n.network_name
FROM agency a
JOIN networks n ON a.network_id = n.network_id
WHERE a.network_code IS NOT NULL;
```

## Interface utilisateur

Les perturbations s'affichent :
- 📍 Entre le sélecteur de date/heure et la navigation des trajets
- 🔴 Couleur rouge pour les travaux et perturbations importantes
- 🟠 Couleur orange pour les arrêts non desservis
- 🔵 Couleur bleue pour les informations générales
- 📱 Interface responsive pour mobile et desktop
- 🌙 Support du mode sombre

## Maintenance

- **Rafraîchissement automatique** : 5 minutes
- **Gestion d'erreur** : Les erreurs API n'interrompent pas l'affichage des horaires
- **Performance** : Requêtes optimisées et mise en cache
- **Évolutivité** : Facile d'ajouter d'autres sources de perturbations

---

## Support

Pour toute question ou problème, vérifiez :
1. Les logs de la console navigateur
2. Les logs du serveur Supabase
3. La documentation de l'API Oise Mobilité
4. La configuration des `network_code` dans la base de données 