CREATE OR REPLACE FUNCTION update_special_trip(
  p_trip_id TEXT,
  p_network_id TEXT,
  p_shape_id TEXT,
  p_trip_short_name TEXT,
  p_stop_times JSONB,
  p_trip_headsign TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_stop_time RECORD;
BEGIN
  -- Mettre à jour la table des voyages
  UPDATE trips
  SET
    shape_id = p_shape_id,
    trip_short_name = p_trip_short_name,
    trip_headsign = p_trip_headsign
  WHERE
    trip_id = p_trip_id AND network_id = p_network_id;

  -- Supprimer les anciens horaires pour ce voyage
  DELETE FROM stop_times WHERE trip_id = p_trip_id AND network_id = p_network_id;

  -- Insérer les nouveaux horaires
  FOR v_stop_time IN SELECT * FROM jsonb_to_recordset(p_stop_times) AS x(stop_id TEXT, stop_sequence INT, arrival_time TEXT, departure_time TEXT)
  LOOP
    INSERT INTO stop_times (trip_id, network_id, arrival_time, departure_time, stop_id, stop_sequence)
    VALUES (
      p_trip_id,
      p_network_id,
      v_stop_time.arrival_time,
      v_stop_time.departure_time,
      v_stop_time.stop_id,
      v_stop_time.stop_sequence
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'trip_id', p_trip_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql; 