-- Supprimer la fonction si elle existe déjà
DROP FUNCTION IF EXISTS horaires_get_connections(text, text, text[]);

-- Créer la fonction pour récupérer les correspondances
CREATE OR REPLACE FUNCTION horaires_get_connections(
  p_network_id text,
  p_route_id text,
  p_stop_ids text[]
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_all_stop_ids text[];
  v_connections jsonb;
BEGIN
  -- Créer une table temporaire pour stocker les IDs d'arrêts avec leurs variantes
  CREATE TEMP TABLE temp_stop_ids AS
  WITH RECURSIVE stop_id_variants AS (
    -- Version de base
    SELECT unnest(p_stop_ids) as stop_id
    UNION
    -- Version sans préfixe départemental
    SELECT COALESCE(split_part(stop_id, ':', 2), stop_id)
    FROM (SELECT unnest(p_stop_ids) as stop_id) s
    WHERE stop_id LIKE '%:%'
    UNION
    -- Versions avec différents préfixes départementaux
    SELECT prefix || ':' || COALESCE(split_part(stop_id, ':', 2), stop_id)
    FROM (SELECT unnest(p_stop_ids) as stop_id) s
    CROSS JOIN (
      SELECT unnest(ARRAY['60', '95', '75', '77', '78', '91', '92', '93', '94']) as prefix
    ) p
    WHERE NOT (stop_id LIKE '%:%' AND split_part(stop_id, ':', 1) = prefix)
  )
  SELECT DISTINCT stop_id FROM stop_id_variants;

  -- Créer un index sur la table temporaire pour accélérer les recherches
  CREATE INDEX ON temp_stop_ids (stop_id);

  -- Récupérer toutes les correspondances en une seule requête
  WITH stop_routes AS (
    SELECT DISTINCT
      st.stop_id,
      r.route_id,
      r.route_short_name,
      r.route_color,
      r.route_text_color,
      -- Utiliser row_number pour dédupliquer les lignes par arrêt
      ROW_NUMBER() OVER (
        PARTITION BY st.stop_id, r.route_id 
        ORDER BY r.route_short_name
      ) as rn
    FROM temp_stop_ids tsi
    JOIN stop_times st ON st.stop_id = tsi.stop_id
    JOIN trips t ON t.trip_id = st.trip_id AND t.network_id = st.network_id
    JOIN routes r ON r.route_id = t.route_id AND r.network_id = t.network_id
    WHERE r.network_id = p_network_id
      AND r.route_id != p_route_id  -- Exclure la ligne actuelle
  ),
  grouped_routes AS (
    -- Ne garder que la première occurrence de chaque ligne par arrêt
    SELECT 
      stop_id,
      jsonb_agg(
        jsonb_build_object(
          'route_id', route_id,
          'route_short_name', route_short_name,
          'route_color', route_color,
          'route_text_color', route_text_color
        )
        ORDER BY route_short_name
      ) as connections
    FROM stop_routes
    WHERE rn = 1
    GROUP BY stop_id
  )
  SELECT 
    jsonb_object_agg(
      COALESCE(gr.stop_id, sid.stop_id),
      COALESCE(gr.connections, '[]'::jsonb)
    )
  INTO v_result
  FROM (SELECT unnest(p_stop_ids) as stop_id) sid
  LEFT JOIN grouped_routes gr ON gr.stop_id = sid.stop_id
  OR gr.stop_id = COALESCE(split_part(sid.stop_id, ':', 2), sid.stop_id)
  OR gr.stop_id LIKE '%:' || COALESCE(split_part(sid.stop_id, ':', 2), sid.stop_id);

  -- Nettoyer
  DROP TABLE temp_stop_ids;

  RETURN v_result;
END;
$$; 