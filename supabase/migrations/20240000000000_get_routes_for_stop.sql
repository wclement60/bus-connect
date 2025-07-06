-- Fonction pour récupérer toutes les lignes qui desservent un arrêt
create or replace function get_routes_for_stop(p_stop_id text, p_network_id text)
returns table (
  route_id text,
  route_short_name text,
  route_long_name text,
  route_color text,
  route_text_color text
) language sql as $$
  SELECT DISTINCT
    r.route_id,
    r.route_short_name,
    r.route_long_name,
    r.route_color,
    r.route_text_color
  FROM routes r
  INNER JOIN trips t ON t.route_id = r.route_id AND t.network_id = r.network_id
  INNER JOIN stop_times st ON st.trip_id = t.trip_id AND st.network_id = t.network_id
  WHERE st.stop_id = p_stop_id
    AND r.network_id = p_network_id
  ORDER BY r.route_short_name;
$$; 