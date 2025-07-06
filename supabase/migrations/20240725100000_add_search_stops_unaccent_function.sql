DROP FUNCTION IF EXISTS search_stops_unaccent(text, text);
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION search_stops_unaccent(
  search_term TEXT,
  p_network_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  stop_id TEXT,
  stop_name TEXT,
  network_id TEXT,
  city TEXT,
  subnetwork_name TEXT,
  stop_lat NUMERIC,
  stop_lon NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.stop_id,
    s.stop_name,
    s.network_id,
    s.city,
    s.subnetwork_name,
    s.stop_lat,
    s.stop_lon
  FROM
    stops AS s
  WHERE
    unaccent(s.stop_name) ILIKE unaccent('%' || search_term || '%')
    AND (p_network_id IS NULL OR s.network_id = p_network_id)
  ORDER BY
    s.stop_name
  LIMIT 100;
END;
$$ LANGUAGE plpgsql; 