-- Test direct des données
WITH next_departure AS (
  -- Trouver le prochain départ pour cette ligne
  SELECT 
    t.trip_id,
    MIN(st.departure_time) as first_departure
  FROM trips t
  JOIN stop_times st ON t.trip_id = st.trip_id
  WHERE t.route_id = 'C1'
  AND t.direction_id = 0
  AND t.network_id = 'AXO'
  GROUP BY t.trip_id
  ORDER BY first_departure
  LIMIT 1
)
SELECT 
  t.trip_id,
  t.service_id,
  s.stop_id,
  s.stop_name,
  st.departure_time::text,
  st.stop_sequence
FROM trips t
JOIN stop_times st ON t.trip_id = st.trip_id
JOIN stops s ON st.stop_id = s.stop_id
WHERE t.route_id = 'C1'
AND t.direction_id = 0
AND t.network_id = 'AXO'
AND t.trip_id = (
  SELECT trip_id 
  FROM next_departure
)
ORDER BY st.stop_sequence;

-- Vérifier les services actifs
SELECT service_id, start_date, end_date, 
       monday, tuesday, wednesday, thursday, friday, saturday, sunday
FROM calendar
WHERE service_id IN (
  SELECT service_id 
  FROM trips 
  WHERE route_id = 'C1' 
  AND network_id = 'AXO'
  AND direction_id = 0
);

-- Vérifier les exceptions de service pour aujourd'hui
SELECT * 
FROM calendar_dates
WHERE service_id IN (
  SELECT service_id 
  FROM trips 
  WHERE route_id = 'C1' 
  AND network_id = 'AXO'
  AND direction_id = 0
)
AND date = CURRENT_DATE; 