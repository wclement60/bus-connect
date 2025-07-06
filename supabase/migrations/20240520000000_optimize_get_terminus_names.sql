-- Création des index nécessaires pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_trips_route_direction ON trips(route_id, direction_id, network_id);

-- Supprimer l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS get_route_directions(text, text);

-- Fonction optimisée pour récupérer les terminus d'une ligne
CREATE OR REPLACE FUNCTION get_route_directions(
  route_id_param text,
  network_id_param text
)
RETURNS TABLE (
  direction_id integer,
  terminus_names text[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.direction_id,
    array_agg(DISTINCT t.trip_headsign ORDER BY t.trip_headsign) AS terminus_names
  FROM trips t
  WHERE t.route_id = route_id_param 
    AND t.network_id = network_id_param
    AND t.trip_headsign IS NOT NULL
  GROUP BY t.direction_id
  ORDER BY t.direction_id;
END;
$$; 