CREATE OR REPLACE FUNCTION create_special_trip(
  p_network_id TEXT,
  p_route_id TEXT,
  p_direction_id INT,
  p_trip_headsign TEXT,
  p_date DATE,
  p_stop_times JSONB,
  p_shape_id TEXT,
  p_trip_short_name TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_service_id TEXT;
  v_trip_id TEXT;
  v_day_of_week TEXT;
  v_stop_time RECORD;
BEGIN
  -- Generate a unique service_id
  v_service_id := 'special-' || to_char(p_date, 'YYYYMMDD') || '-' || to_char(now(), 'HH24MISSMS');
  
  -- Generate a unique trip_id
  v_trip_id := 'special-trip-' || to_char(p_date, 'YYYYMMDD') || '-' || to_char(now(), 'HH24MISSMS');

  -- Determine day of the week
  SELECT to_char(p_date, 'day') INTO v_day_of_week;
  v_day_of_week := trim(lower(v_day_of_week));

  -- Insert into calendar
  -- This creates a service that is only valid for a single day.
  INSERT INTO calendar (service_id, network_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
  VALUES (
    v_service_id,
    p_network_id,
    v_day_of_week = 'monday',
    v_day_of_week = 'tuesday',
    v_day_of_week = 'wednesday',
    v_day_of_week = 'thursday',
    v_day_of_week = 'friday',
    v_day_of_week = 'saturday',
    v_day_of_week = 'sunday',
    p_date,
    p_date
  );

  -- Insert into trips
  INSERT INTO trips (trip_id, network_id, route_id, service_id, trip_headsign, direction_id, shape_id, trip_short_name)
  VALUES (
    v_trip_id,
    p_network_id,
    p_route_id,
    v_service_id,
    p_trip_headsign,
    p_direction_id,
    p_shape_id,
    p_trip_short_name
  );

  -- Insert into stop_times
  FOR v_stop_time IN SELECT * FROM jsonb_to_recordset(p_stop_times) AS x(stop_id TEXT, stop_sequence INT, arrival_time TEXT, departure_time TEXT)
  LOOP
    INSERT INTO stop_times (trip_id, network_id, arrival_time, departure_time, stop_id, stop_sequence)
    VALUES (
      v_trip_id,
      p_network_id,
      v_stop_time.arrival_time,
      v_stop_time.departure_time,
      v_stop_time.stop_id,
      v_stop_time.stop_sequence
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'trip_id', v_trip_id, 'service_id', v_service_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql; 