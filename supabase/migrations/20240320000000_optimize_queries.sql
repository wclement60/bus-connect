-- Fonction pour récupérer toutes les données des horaires en une seule requête
CREATE OR REPLACE FUNCTION public.get_timetable_data(
  network_id_param uuid,
  service_id_param text,
  direction_id_param integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH trip_data AS (
    SELECT 
      t.*,
      json_agg(
        json_build_object(
          'stop_id', st.stop_id,
          'arrival_time', st.arrival_time,
          'departure_time', st.departure_time,
          'stop_sequence', st.stop_sequence,
          'stop_name', s.stop_name,
          'stop_lat', s.stop_lat,
          'stop_lon', s.stop_lon
        ) ORDER BY st.stop_sequence
      ) as stop_times
    FROM trips t
    JOIN stop_times st ON t.trip_id = st.trip_id AND t.network_id = st.network_id
    JOIN stops s ON st.stop_id = s.stop_id AND st.network_id = s.network_id
    WHERE t.network_id = network_id_param
    AND t.service_id = service_id_param
    AND t.direction_id = direction_id_param
    GROUP BY t.trip_id, t.network_id
  )
  SELECT json_build_object(
    'trips', json_agg(
      json_build_object(
        'trip_id', trip_id,
        'route_id', route_id,
        'service_id', service_id,
        'direction_id', direction_id,
        'stop_times', stop_times
      )
    )
  ) INTO result
  FROM trip_data;

  RETURN result;
END;
$$;

-- Fonction pour récupérer les connexions des arrêts en une seule requête
CREATE OR REPLACE FUNCTION public.get_stop_connections(
  network_id_param uuid,
  stop_ids text[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH connections AS (
    SELECT DISTINCT
      st.stop_id,
      r.route_id,
      r.route_short_name,
      r.route_color,
      r.route_text_color
    FROM stop_times st
    JOIN trips t ON st.trip_id = t.trip_id AND st.network_id = t.network_id
    JOIN routes r ON t.route_id = r.route_id AND t.network_id = r.network_id
    WHERE st.network_id = network_id_param
    AND st.stop_id = ANY(stop_ids)
  )
  SELECT json_object_agg(
    stop_id,
    json_agg(
      json_build_object(
        'route_id', route_id,
        'route_short_name', route_short_name,
        'route_color', route_color,
        'route_text_color', route_text_color
      )
    )
  ) INTO result
  FROM connections
  GROUP BY stop_id;

  RETURN result;
END;
$$; 