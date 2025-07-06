CREATE OR REPLACE FUNCTION get_route_trips_with_stops(
  p_route_id text,
  p_network_id text,
  p_stop_ids text[],
  p_current_time text,
  p_current_date text,
  p_day_of_week integer
)
RETURNS TABLE (
  trip_id text,
  trip_headsign text,
  service_id text,
  stop_sequence integer,
  next_stops integer,
  future_departures jsonb,
  is_active_service boolean
) AS $$
BEGIN
  RETURN QUERY
  WITH regular_services AS (
    -- Get base calendar services for today
    SELECT 
      c.service_id
    FROM calendar c
    WHERE c.network_id = p_network_id
      AND c.start_date <= TO_DATE(p_current_date, 'YYYYMMDD')
      AND c.end_date >= TO_DATE(p_current_date, 'YYYYMMDD')
      AND (
        CASE p_day_of_week
          WHEN 0 THEN CAST(c.sunday AS INTEGER)
          WHEN 1 THEN CAST(c.monday AS INTEGER)
          WHEN 2 THEN CAST(c.tuesday AS INTEGER)
          WHEN 3 THEN CAST(c.wednesday AS INTEGER)
          WHEN 4 THEN CAST(c.thursday AS INTEGER)
          WHEN 5 THEN CAST(c.friday AS INTEGER)
          WHEN 6 THEN CAST(c.saturday AS INTEGER)
        END = 1
      )
  ),
  added_services AS (
    -- Services added by exception
    SELECT cd.service_id
    FROM calendar_dates cd
    WHERE cd.network_id = p_network_id
      AND cd.date = TO_DATE(p_current_date, 'YYYYMMDD')
      AND cd.exception_type = 1
  ),
  removed_services AS (
    -- Services removed by exception
    SELECT cd.service_id
    FROM calendar_dates cd
    WHERE cd.network_id = p_network_id
      AND cd.date = TO_DATE(p_current_date, 'YYYYMMDD')
      AND cd.exception_type = 2
  ),
  valid_services AS (
    -- Combine regular and added services, excluding removed ones
    (SELECT rs.service_id, TRUE as is_active 
     FROM regular_services rs
     WHERE rs.service_id NOT IN (SELECT rm.service_id FROM removed_services rm))
    UNION
    (SELECT ads.service_id, TRUE as is_active 
     FROM added_services ads)
  ),
  base_trips AS (
    -- Get base trip information with specific stop sequence
    SELECT DISTINCT ON (t.trip_id, s.stop_id)
      t.trip_id,
      t.trip_headsign,
      t.service_id,
      s.stop_sequence,
      s.stop_id,
      COALESCE(vs.is_active, FALSE) as is_active_service
    FROM trips t
    JOIN stop_times s ON t.trip_id = s.trip_id 
      AND t.network_id = s.network_id 
      AND s.stop_id = ANY(p_stop_ids)
    LEFT JOIN valid_services vs ON t.service_id = vs.service_id
    WHERE t.route_id = p_route_id
      AND t.network_id = p_network_id
  ),
  trip_next_stops AS (
    -- Calculate next stops for each trip
    SELECT 
      bt.trip_id,
      bt.trip_headsign,
      bt.service_id,
      bt.stop_sequence,
      bt.stop_id,
      bt.is_active_service,
      CAST(COUNT(*) AS integer) as next_stops
    FROM base_trips bt
    JOIN stop_times st ON bt.trip_id = st.trip_id
      AND st.stop_sequence > bt.stop_sequence
    GROUP BY bt.trip_id, bt.trip_headsign, bt.service_id, bt.stop_sequence, bt.stop_id, bt.is_active_service
  ),
  trip_future_times AS (
    -- Get future departures for each trip, ensuring they match the correct stop and direction
    SELECT 
      tns.trip_id,
      tns.stop_id,
      jsonb_agg(
        jsonb_build_object(
          'trip_id', tns.trip_id,
          'departure_time', st.departure_time
        )
        ORDER BY st.departure_time
      ) FILTER (WHERE tns.is_active_service = TRUE) as future_departures
    FROM trip_next_stops tns
    JOIN stop_times st ON tns.trip_id = st.trip_id
      AND st.stop_id = tns.stop_id
      AND st.departure_time >= p_current_time
    GROUP BY tns.trip_id, tns.stop_id
  ),
  final_results AS (
    SELECT DISTINCT ON (tns.trip_id, tns.trip_headsign, tns.stop_id)
      tns.trip_id,
      tns.trip_headsign,
      tns.service_id,
      tns.stop_sequence,
      tns.next_stops,
      COALESCE(tft.future_departures, '[]'::jsonb) as future_departures,
      tns.is_active_service,
      CASE 
        WHEN NOT tns.is_active_service THEN 2  -- Service ne circule pas ce jour
        WHEN tns.is_active_service AND COALESCE(jsonb_array_length(tft.future_departures), 0) = 0 THEN 1  -- Fin de service
        ELSE 0  -- Service actif avec horaires
      END as display_order
    FROM trip_next_stops tns
    LEFT JOIN trip_future_times tft ON tns.trip_id = tft.trip_id AND tns.stop_id = tft.stop_id
    WHERE tns.next_stops > 0
  )
  SELECT 
    fr.trip_id,
    fr.trip_headsign,
    fr.service_id,
    fr.stop_sequence,
    fr.next_stops,
    fr.future_departures,
    fr.is_active_service
  FROM final_results fr
  ORDER BY 
    fr.display_order,  -- Trier d'abord par statut (actif, fin de service, ne circule pas)
    fr.trip_headsign,  -- Puis par direction
    fr.stop_sequence;  -- Puis par séquence d'arrêt
END;
$$ LANGUAGE plpgsql; 