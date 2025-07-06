CREATE OR REPLACE FUNCTION delete_special_trip(
  p_trip_id TEXT,
  p_network_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_service_id TEXT;
  v_service_id_usage_count INT;
BEGIN
  -- Trouver le service_id pour le voyage
  SELECT service_id INTO v_service_id FROM trips WHERE trip_id = p_trip_id AND network_id = p_network_id;

  -- Si aucun service_id n'est trouvé, le voyage n'existe pas, retourner avec succès
  IF v_service_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Voyage non trouvé, rien à supprimer.');
  END IF;
  
  -- Supprimer d'abord de stop_times à cause des contraintes de clé étrangère
  DELETE FROM stop_times WHERE trip_id = p_trip_id AND network_id = p_network_id;

  -- Supprimer le voyage lui-même
  DELETE FROM trips WHERE trip_id = p_trip_id AND network_id = p_network_id;
  
  -- Vérifier si un autre voyage utilise le même service_id
  SELECT COUNT(*) INTO v_service_id_usage_count FROM trips WHERE service_id = v_service_id AND network_id = p_network_id;
  
  -- Si aucun autre voyage n'utilise ce service_id, le supprimer de calendar et calendar_dates
  IF v_service_id_usage_count = 0 THEN
    DELETE FROM calendar WHERE service_id = v_service_id AND network_id = p_network_id;
    DELETE FROM calendar_dates WHERE service_id = v_service_id AND network_id = p_network_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'trip_id', p_trip_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql; 