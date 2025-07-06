-- Exemple de configuration des network_code pour l'intégration avec l'API de perturbations
-- Copiez et adaptez ces requêtes selon vos réseaux de transport

-- ======================================================================
-- ÉTAPE 1: Vérifier les réseaux existants dans votre base de données
-- ======================================================================

-- Voir tous les réseaux disponibles
SELECT network_id, network_name 
FROM networks 
ORDER BY network_name;

-- Voir toutes les agences existantes
SELECT agency_id, network_id, agency_name, network_code
FROM agency 
ORDER BY network_id, agency_name;

-- ======================================================================
-- ÉTAPE 2: Configurer les network_code (exemples basés sur l'API Oise Mobilité)
-- ======================================================================

-- AXO Transport (région Hauts-de-France)
-- Exemple de network_code trouvé dans l'API: 51
UPDATE agency 
SET network_code = 51 
WHERE network_id = 'AXO';

-- TIC Interurbain - Agglo de la région de Compiègne
-- Exemple de network_code trouvé dans l'API: 49
UPDATE agency 
SET network_code = 49 
WHERE network_id = 'TIC' OR network_id = 'TIC_INT';

-- KEOLIS (si présent dans votre système)
-- UPDATE agency SET network_code = 52 WHERE network_id = 'KEOLIS';

-- STAR Rennes (si présent)
-- UPDATE agency SET network_code = 53 WHERE network_id = 'STAR';

-- CAP Agglo (si présent)
-- UPDATE agency SET network_code = 54 WHERE network_id = 'CAP';

-- ======================================================================
-- ÉTAPE 3: Ajouter d'autres réseaux selon vos besoins
-- ======================================================================

-- Template pour ajouter un nouveau réseau:
-- UPDATE agency SET network_code = [NETWORK_ID_FROM_API] WHERE network_id = '[YOUR_NETWORK_ID]';

-- Exemples supplémentaires (à adapter selon votre situation):

-- Réseau HOPLA (Pays de Bray)
-- UPDATE agency SET network_code = 55 WHERE network_id = 'HOPLA';

-- Réseau MOBI (si présent)
-- UPDATE agency SET network_code = 56 WHERE network_id = 'MOBI';

-- Réseau LE BUS (si présent)
-- UPDATE agency SET network_code = 57 WHERE network_id = 'LEBUS';

-- ======================================================================
-- ÉTAPE 4: Vérification de la configuration
-- ======================================================================

-- Vérifier que les network_code ont été correctement configurés
SELECT 
    a.agency_id,
    a.network_id,
    a.agency_name,
    a.network_code,
    n.network_name
FROM agency a
JOIN networks n ON a.network_id = n.network_id
WHERE a.network_code IS NOT NULL
ORDER BY a.network_id;

-- Vérifier les réseaux sans network_code configuré
SELECT 
    a.agency_id,
    a.network_id,
    a.agency_name,
    n.network_name
FROM agency a
JOIN networks n ON a.network_id = n.network_id
WHERE a.network_code IS NULL
ORDER BY a.network_id;

-- ======================================================================
-- ÉTAPE 5: Test avec une requête de validation
-- ======================================================================

-- Cette requête simule ce que fera l'application pour récupérer le network_code
SELECT network_code 
FROM agency 
WHERE network_id = 'AXO' 
LIMIT 1;

-- ======================================================================
-- NOTES IMPORTANTES:
-- ======================================================================

/*
1. Pour trouver les network_code corrects, consultez l'API:
   https://api.oisemob.cityway.fr/disrupt/api/v1/fr/disruptions

2. Recherchez dans la réponse JSON le champ "networkId" correspondant
   à vos réseaux de transport.

3. Exemple de structure JSON de l'API:
   {
     "affectedLines": [
       {
         "networkId": 51,
         "networkName": "AXO Transport",
         "number": "B"
       }
     ]
   }

4. Si un réseau n'a pas de perturbations dans l'API Oise Mobilité,
   ne configurez pas de network_code pour ce réseau. L'application
   fonctionnera normalement sans afficher d'alertes de trafic.

5. Vous pouvez mettre à jour les network_code à tout moment.
   Les modifications prendront effet immédiatement dans l'application.

6. Pour les réseaux avec plusieurs agences, assurez-vous que toutes
   les agences du même réseau ont le même network_code.
*/ 