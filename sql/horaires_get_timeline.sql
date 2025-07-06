-- Supprimer toutes les versions possibles de la fonction
DROP FUNCTION IF EXISTS horaires_get_timeline(text, text, text, text, text, integer);
DROP FUNCTION IF EXISTS horaires_get_timeline(text, text, text, time without time zone, text, integer);
DROP FUNCTION IF EXISTS horaires_get_timeline(text, text, text, text, text, text);
DROP FUNCTION IF EXISTS horaires_get_timeline(text, text, text, time, text, text);
DROP FUNCTION IF EXISTS horaires_get_timeline(text, text, text, time, text, int);
DROP FUNCTION IF EXISTS horaires_get_timeline(text, text, text, text, text, int);

-- Fonction utilitaire pour convertir les heures 24h+ en heures standard
CREATE OR REPLACE FUNCTION normalize_time(time_str text)
RETURNS time
LANGUAGE plpgsql
AS $$
DECLARE
    hour_part integer;
    minute_part integer;
    second_part integer;
    normalized_hour integer;
BEGIN
    -- Extraire les parties de l'heure
    hour_part := (regexp_match(time_str, '^(\d+):'))[1]::integer;
    minute_part := (regexp_match(time_str, ':(\d+):'))[1]::integer;
    second_part := (regexp_match(time_str, ':(\d+)$'))[1]::integer;
    
    -- Si l'heure est 24 ou plus, la normaliser
    IF hour_part >= 24 THEN
        normalized_hour := hour_part - 24;
    ELSE
        normalized_hour := hour_part;
    END IF;
    
    -- Construire l'heure normalisée
    RETURN (normalized_hour::text || ':' || minute_part::text || ':' || second_part::text)::time;
END;
$$;

-- Créer la nouvelle version avec des types précis
CREATE OR REPLACE FUNCTION horaires_get_timeline(
  p_network_id text,
  p_route_id text,
  p_direction_id text,
  p_current_time text,
  p_current_date text,
  p_day_of_week text
)
RETURNS TABLE (
  stop_id text,
  stop_name text,
  departure_time text,
  stop_sequence integer,
  debug_info jsonb
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_trip_count integer;
  v_next_trip_id text;
  v_debug_info jsonb;
  v_current_time time;
  v_is_after_midnight boolean;
BEGIN
  -- Initialiser le debug_info
  v_debug_info := jsonb_build_object(
    'params', jsonb_build_object(
      'network_id', p_network_id,
      'route_id', p_route_id,
      'direction_id', p_direction_id,
      'current_time', p_current_time,
      'current_date', p_current_date,
      'day_of_week', p_day_of_week
    )
  );

  -- Convertir l'heure actuelle en type time
  v_current_time := p_current_time::time;
  
  -- Déterminer si nous sommes après minuit
  v_is_after_midnight := v_current_time < '05:00:00'::time;

  -- Vérifier les trips disponibles
  SELECT COUNT(*) INTO v_trip_count
  FROM trips t
  WHERE t.network_id = p_network_id
  AND t.route_id = p_route_id;

  v_debug_info := v_debug_info || jsonb_build_object('total_trips_count', v_trip_count);

  -- Trouver le prochain trip
  WITH next_departure AS (
    SELECT 
      t.trip_id,
      MIN(
        CASE 
          WHEN st.departure_time ~ '^2[4-9]:|^3[0-9]:' THEN normalize_time(st.departure_time)
          ELSE st.departure_time::time
        END
      ) as first_departure,
      MIN(st.departure_time) as original_departure_time
    FROM trips t
    JOIN calendar c ON t.service_id = c.service_id AND c.network_id = t.network_id
    JOIN stop_times st ON t.trip_id = st.trip_id
    WHERE t.route_id = p_route_id
    AND t.direction_id = p_direction_id::integer
    AND t.network_id = p_network_id
    AND c.start_date <= p_current_date::date
    AND c.end_date >= p_current_date::date
    AND CASE p_day_of_week::integer
      WHEN 0 THEN c.sunday = true
      WHEN 1 THEN c.monday = true
      WHEN 2 THEN c.tuesday = true
      WHEN 3 THEN c.wednesday = true
      WHEN 4 THEN c.thursday = true
      WHEN 5 THEN c.friday = true
      WHEN 6 THEN c.saturday = true
    END
    AND NOT EXISTS (
      SELECT 1 
      FROM calendar_dates cd
      WHERE cd.service_id = t.service_id
      AND cd.date = p_current_date::date
      AND cd.exception_type = 2
      AND cd.network_id = t.network_id
    )
    GROUP BY t.trip_id
    HAVING (
      CASE
        WHEN v_is_after_midnight THEN 
          MIN(CASE 
            WHEN st.departure_time ~ '^2[4-9]:|^3[0-9]:' THEN normalize_time(st.departure_time)
            ELSE st.departure_time::time
          END) >= v_current_time
          OR MIN(st.departure_time) ~ '^2[4-9]:|^3[0-9]:'
        ELSE 
          MIN(CASE 
            WHEN st.departure_time ~ '^2[4-9]:|^3[0-9]:' THEN normalize_time(st.departure_time)
            ELSE st.departure_time::time
          END) >= v_current_time
          AND MIN(st.departure_time) !~ '^2[4-9]:|^3[0-9]:'
      END
    )
  )
  SELECT trip_id INTO v_next_trip_id
  FROM next_departure
  ORDER BY first_departure
  LIMIT 1;

  v_debug_info := v_debug_info || jsonb_build_object('next_trip_id', v_next_trip_id);

  -- Si on a trouvé un trip, retourner ses arrêts
  IF v_next_trip_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      s.stop_id,
      s.stop_name,
      st.departure_time::text,
      st.stop_sequence,
      v_debug_info
    FROM stop_times st
    JOIN stops s ON st.stop_id = s.stop_id
    JOIN trips t ON st.trip_id = t.trip_id
    WHERE st.trip_id = v_next_trip_id
    AND t.network_id = p_network_id
    AND s.network_id = p_network_id
    ORDER BY st.stop_sequence;
  ELSE
    -- Si aucun trip n'est trouvé, retourner quand même les infos de debug
    RETURN QUERY
    SELECT 
      NULL::text as stop_id,
      NULL::text as stop_name,
      NULL::text as departure_time,
      NULL::integer as stop_sequence,
      v_debug_info;
  END IF;
END;
$$; 