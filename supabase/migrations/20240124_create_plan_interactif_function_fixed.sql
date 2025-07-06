-- Fonction RPC optimisée pour charger rapidement les arrêts du plan interactif (VERSION CORRIGÉE)
CREATE OR REPLACE FUNCTION public.plan_interactif_stops(
  p_network_id TEXT,
  p_route_ids TEXT[]
)
RETURNS TABLE (
  stop_id TEXT,
  stop_name TEXT,
  stop_lat NUMERIC,
  stop_lon NUMERIC,
  stop_desc TEXT,
  route_ids TEXT[]  -- Les lignes qui passent par cet arrêt
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- Récupérer tous les trips des lignes sélectionnées
  selected_trips AS (
    SELECT DISTINCT t.trip_id, t.route_id
    FROM trips t
    WHERE t.network_id = p_network_id
      AND t.route_id = ANY(p_route_ids)
  ),
  -- Récupérer tous les arrêts de ces trips avec leurs lignes
  stops_with_routes AS (
    SELECT DISTINCT 
      s.stop_id,
      s.stop_name,
      s.stop_lat,
      s.stop_lon,
      s.stop_desc,
      t.route_id  -- Utiliser t.route_id depuis la table trips, pas st.route_id
    FROM stop_times st
    INNER JOIN stops s ON s.stop_id = st.stop_id AND s.network_id = st.network_id
    INNER JOIN selected_trips t ON t.trip_id = st.trip_id
    WHERE st.network_id = p_network_id
      AND s.stop_lat IS NOT NULL
      AND s.stop_lon IS NOT NULL
  )
  -- Agréger les route_ids par arrêt
  SELECT 
    swr.stop_id,
    swr.stop_name,
    swr.stop_lat,
    swr.stop_lon,
    swr.stop_desc,
    array_agg(DISTINCT swr.route_id ORDER BY swr.route_id) as route_ids
  FROM stops_with_routes swr
  GROUP BY 
    swr.stop_id,
    swr.stop_name,
    swr.stop_lat,
    swr.stop_lon,
    swr.stop_desc
  ORDER BY swr.stop_name;
END;
$$;

-- Fonction RPC optimisée pour charger rapidement les tracés des lignes (INCHANGÉE)
CREATE OR REPLACE FUNCTION public.plan_interactif_shapes(
  p_network_id TEXT,
  p_route_ids TEXT[]
)
RETURNS TABLE (
  route_id TEXT,
  route_short_name TEXT,
  route_long_name TEXT,
  route_color TEXT,
  route_text_color TEXT,
  coordinates JSONB  -- Array d'arrays de [longitude, latitude] pour chaque segment
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- Récupérer les shapes pour les lignes sélectionnées
  route_shapes AS (
    SELECT DISTINCT 
      t.route_id,
      t.shape_id
    FROM trips t
    WHERE t.network_id = p_network_id
      AND t.route_id = ANY(p_route_ids)
      AND t.shape_id IS NOT NULL
  ),
  -- Récupérer et agréger les points par shape_id
  shape_coordinates AS (
    SELECT 
      rs.route_id,
      rs.shape_id,
      jsonb_agg(
        jsonb_build_array(s.shape_pt_lon, s.shape_pt_lat) 
        ORDER BY s.shape_pt_sequence
      ) as shape_coords
    FROM route_shapes rs
    INNER JOIN shapes s ON s.shape_id = rs.shape_id AND s.network_id = p_network_id
    WHERE s.shape_pt_lon IS NOT NULL 
      AND s.shape_pt_lat IS NOT NULL
    GROUP BY rs.route_id, rs.shape_id
  ),
  -- Combiner tous les segments d'une même ligne
  route_coordinates AS (
    SELECT 
      sc.route_id,
      jsonb_agg(sc.shape_coords ORDER BY sc.shape_id) as coordinates
    FROM shape_coordinates sc
    GROUP BY sc.route_id
  )
  -- Joindre avec les informations des routes
  SELECT 
    r.route_id,
    r.route_short_name,
    r.route_long_name,
    r.route_color,
    r.route_text_color,
    COALESCE(rc.coordinates, '[]'::jsonb) as coordinates
  FROM routes r
  LEFT JOIN route_coordinates rc ON rc.route_id = r.route_id
  WHERE r.network_id = p_network_id
    AND r.route_id = ANY(p_route_ids)
  ORDER BY r.route_short_name;
END;
$$;

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_trips_network_route 
ON trips(network_id, route_id);

CREATE INDEX IF NOT EXISTS idx_trips_network_route_shape 
ON trips(network_id, route_id, shape_id);

CREATE INDEX IF NOT EXISTS idx_stop_times_network_trip 
ON stop_times(network_id, trip_id);

CREATE INDEX IF NOT EXISTS idx_stops_network_coords 
ON stops(network_id, stop_lat, stop_lon)
WHERE stop_lat IS NOT NULL AND stop_lon IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shapes_network_id_sequence 
ON shapes(network_id, shape_id, shape_pt_sequence);

CREATE INDEX IF NOT EXISTS idx_routes_network_route_id 
ON routes(network_id, route_id);

-- Commenter les fonctions
COMMENT ON FUNCTION public.plan_interactif_stops IS 'Fonction optimisée pour récupérer rapidement tous les arrêts uniques des lignes sélectionnées pour le plan interactif';
COMMENT ON FUNCTION public.plan_interactif_shapes IS 'Fonction optimisée pour récupérer rapidement tous les tracés des lignes sélectionnées pour le plan interactif';

-- Donner les permissions d'exécution
GRANT EXECUTE ON FUNCTION public.plan_interactif_stops TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_interactif_stops TO anon;
GRANT EXECUTE ON FUNCTION public.plan_interactif_shapes TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_interactif_shapes TO anon; 