-- Migration pour ajouter les colonnes de configuration d'API temps réel à la table des réseaux

-- Ajouter les colonnes de configuration SIRI 
ALTER TABLE networks ADD COLUMN IF NOT EXISTS has_siri_api BOOLEAN DEFAULT FALSE;
ALTER TABLE networks ADD COLUMN IF NOT EXISTS siri_api_url TEXT;
ALTER TABLE networks ADD COLUMN IF NOT EXISTS siri_api_params JSONB DEFAULT '{}'::JSONB;

-- Ajouter les colonnes de configuration GTFS-RT
ALTER TABLE networks ADD COLUMN IF NOT EXISTS has_gtfs_rt_api BOOLEAN DEFAULT FALSE;
ALTER TABLE networks ADD COLUMN IF NOT EXISTS gtfs_rt_url TEXT;
ALTER TABLE networks ADD COLUMN IF NOT EXISTS gtfs_rt_params JSONB DEFAULT '{}'::JSONB;

-- Ajouter une colonne pour indiquer si une clé API est requise
ALTER TABLE networks ADD COLUMN IF NOT EXISTS requires_api_key BOOLEAN DEFAULT FALSE;

-- Créer un index sur les colonnes booléennes pour des recherches plus rapides
CREATE INDEX IF NOT EXISTS idx_networks_has_siri_api ON networks (has_siri_api) WHERE has_siri_api = TRUE;
CREATE INDEX IF NOT EXISTS idx_networks_has_gtfs_rt_api ON networks (has_gtfs_rt_api) WHERE has_gtfs_rt_api = TRUE;

-- Créer une vue qui liste les réseaux avec des API temps réel actives
DROP VIEW IF EXISTS networks_with_realtime;

CREATE OR REPLACE VIEW networks_with_realtime AS
-- Vue principale avec les configurations au niveau réseau
SELECT 
  network_id,
  network_name,
  NULL AS subnetwork_name,
  has_siri_api,
  siri_api_url,
  siri_api_params,
  has_gtfs_rt_api,
  gtfs_rt_url,
  gtfs_rt_params,
  requires_api_key,
  CASE 
    WHEN has_siri_api AND has_gtfs_rt_api THEN 'BOTH'
    WHEN has_siri_api THEN 'SIRI'
    WHEN has_gtfs_rt_api THEN 'GTFS-RT'
    ELSE 'NONE'
  END AS realtime_type
FROM networks
WHERE has_siri_api = TRUE OR has_gtfs_rt_api = TRUE

UNION ALL

-- Vue des configurations au niveau sous-réseau
SELECT 
  n.network_id,
  n.network_name,
  s->>'name' AS subnetwork_name,
  CASE WHEN (s->'realtime'->>'type') = 'siri' THEN TRUE ELSE FALSE END AS has_siri_api,
  CASE WHEN (s->'realtime'->>'type') = 'siri' THEN (s->'realtime'->>'url') ELSE NULL END AS siri_api_url,
  CASE WHEN (s->'realtime'->>'type') = 'siri' THEN 
    COALESCE((s->'realtime'->'params')::JSONB, '{}'::JSONB) 
  ELSE 
    '{}'::JSONB 
  END AS siri_api_params,
  CASE WHEN (s->'realtime'->>'type') = 'gtfs-rt' THEN TRUE ELSE FALSE END AS has_gtfs_rt_api,
  CASE WHEN (s->'realtime'->>'type') = 'gtfs-rt' THEN (s->'realtime'->>'url') ELSE NULL END AS gtfs_rt_url,
  CASE WHEN (s->'realtime'->>'type') = 'gtfs-rt' THEN 
    COALESCE((s->'realtime'->'params')::JSONB, '{}'::JSONB) 
  ELSE 
    '{}'::JSONB 
  END AS gtfs_rt_params,
  COALESCE((s->'realtime'->>'requires_api_key')::BOOLEAN, FALSE) AS requires_api_key,
  CASE 
    WHEN (s->'realtime'->>'type') = 'siri' THEN 'SIRI'
    WHEN (s->'realtime'->>'type') = 'gtfs-rt' THEN 'GTFS-RT'
    ELSE 'NONE'
  END AS realtime_type
FROM networks n, jsonb_array_elements(n.subnetworks) s
WHERE (s->'realtime'->>'type') IS NOT NULL AND (s->'realtime'->>'url') IS NOT NULL;

-- Ajouter une fonction pour mettre à jour facilement la configuration API
CREATE OR REPLACE FUNCTION update_realtime_config(
  p_network_id TEXT,
  p_has_siri_api BOOLEAN,
  p_siri_api_url TEXT,
  p_siri_api_params JSONB,
  p_has_gtfs_rt_api BOOLEAN,
  p_gtfs_rt_url TEXT,
  p_gtfs_rt_params JSONB,
  p_requires_api_key BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE networks
  SET 
    has_siri_api = p_has_siri_api,
    siri_api_url = p_siri_api_url,
    siri_api_params = p_siri_api_params,
    has_gtfs_rt_api = p_has_gtfs_rt_api,
    gtfs_rt_url = p_gtfs_rt_url,
    gtfs_rt_params = p_gtfs_rt_params,
    requires_api_key = p_requires_api_key
  WHERE network_id = p_network_id;
  
  RETURN FOUND;
END;
$$;

-- Ajouter la configuration pour le réseau TOHM comme exemple
DO $$
BEGIN
  -- Vérifier si le réseau TOHM existe
  IF EXISTS (SELECT 1 FROM networks WHERE network_id = 'TOHM') THEN
    -- Mettre à jour la configuration des API temps réel pour le réseau TOHM
    PERFORM update_realtime_config(
      'TOHM',                                                             -- network_id
      TRUE,                                                               -- has_siri_api
      'https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download',   -- siri_api_url
      '{"provider": "TOHM", "dataFormat": "SIRI-SM"}'::JSONB,            -- siri_api_params
      TRUE,                                                               -- has_gtfs_rt_api
      'https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download',   -- gtfs_rt_url
      '{"provider": "TOHM", "dataFormat": "gtfs-rt"}'::JSONB,            -- gtfs_rt_params
      FALSE                                                               -- requires_api_key
    );
  END IF;
END $$; 