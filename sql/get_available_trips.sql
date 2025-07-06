-- D'abord supprimer la fonction existante
DROP FUNCTION IF EXISTS get_available_trips(text, text, text, text, text);

-- Fonction pour récupérer tous les trips disponibles pour une ligne et une date spécifiques
CREATE OR REPLACE FUNCTION get_available_trips(
  p_network_id text,
  p_route_id text,
  p_direction_id text,
  p_current_date text,
  p_day_of_week text
)
RETURNS TABLE (
  trip_id text,
  first_departure_time text,
  last_arrival_time text,
  trip_headsign text,
  network_id text,
  route_id text,
  direction_id integer
) 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Log pour le débogage
  RAISE NOTICE 'Recherche des trips pour réseau: %, ligne: %, direction: %, date: %, jour: %', 
    p_network_id, p_route_id, p_direction_id, p_current_date, p_day_of_week;

  RETURN QUERY
  WITH valid_services AS (
    -- Services réguliers de la table calendar
    SELECT c.service_id
    FROM calendar c
    WHERE c.network_id = p_network_id
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
    
    UNION
    
    -- Services ajoutés par exception dans calendar_dates (type 1)
    SELECT cd.service_id
    FROM calendar_dates cd
    WHERE cd.network_id = p_network_id
      AND cd.date = p_current_date::date
      AND cd.exception_type = 1
  ),
  trip_schedule AS (
    SELECT 
      t.trip_id,
      t.trip_headsign,
      t.network_id,
      t.route_id,
      t.direction_id,
      MIN(st.departure_time) as first_departure_time,
      MAX(st.arrival_time) as last_arrival_time
    FROM trips t
    JOIN valid_services vs ON t.service_id = vs.service_id
    JOIN stop_times st ON t.trip_id = st.trip_id
    WHERE t.route_id = p_route_id
      AND t.direction_id = p_direction_id::integer
      AND t.network_id = p_network_id
      AND NOT EXISTS (
        SELECT 1 
        FROM calendar_dates cd
        WHERE cd.service_id = t.service_id
          AND cd.date = p_current_date::date
          AND cd.exception_type = 2
          AND cd.network_id = t.network_id
      )
    GROUP BY t.trip_id, t.trip_headsign, t.network_id, t.route_id, t.direction_id
  )
  SELECT 
    ts.trip_id,
    ts.first_departure_time,
    ts.last_arrival_time,
    ts.trip_headsign,
    ts.network_id,
    ts.route_id,
    ts.direction_id
  FROM trip_schedule ts
  WHERE ts.network_id = p_network_id
    AND ts.route_id = p_route_id
    AND ts.direction_id = p_direction_id::integer
  ORDER BY 
    CASE 
      WHEN ts.first_departure_time ~ '^2[4-9]:|^3[0-9]:' THEN 
        -- Pour les horaires après minuit (24:00+), les placer après les horaires normaux
        REGEXP_REPLACE(ts.first_departure_time, '^2([4-9]):', '0\1:')::time + interval '24 hours'
      ELSE ts.first_departure_time::time
    END;
END;
$$; 