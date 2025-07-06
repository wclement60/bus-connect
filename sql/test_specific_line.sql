-- Test des trips disponibles pour la ligne 640 du réseau ko2
SELECT t.trip_id, t.trip_headsign, t.service_id, t.direction_id, c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday, c.sunday
FROM trips t
JOIN calendar c ON t.service_id = c.service_id
WHERE t.route_id = '640'
AND t.network_id = 'ko2'
ORDER BY t.direction_id, t.trip_headsign;

-- Test des arrêts pour un trip spécifique
WITH sample_trip AS (
  SELECT trip_id 
  FROM trips
  WHERE route_id = '640'
  AND network_id = 'ko2'
  LIMIT 1
)
SELECT s.stop_name, st.departure_time, st.stop_sequence
FROM stop_times st
JOIN stops s ON st.stop_id = s.stop_id
WHERE st.trip_id = (SELECT trip_id FROM sample_trip)
ORDER BY st.stop_sequence;

-- Test direct de la fonction avec des paramètres spécifiques
SELECT * FROM horaires_get_timeline(
  'ko2',         -- p_network_id
  '640',         -- p_route_id
  '0',           -- p_direction_id
  '08:00',       -- p_current_time (format HH:MM)
  '20250602',    -- p_current_date (format YYYYMMDD)
  1              -- p_day_of_week (1 = lundi)
); 