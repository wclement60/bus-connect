-- Force Delete Network Function
-- Cette fonction permet de forcer la suppression d'un réseau même si des contraintes de clé étrangère existent
CREATE OR REPLACE FUNCTION public.force_delete_network(network_id_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- S'exécute avec les privilèges du créateur
AS $$
BEGIN
  -- Désactiver temporairement les contraintes de clé étrangère
  SET session_replication_role = 'replica';

  -- Supprimer les données des tables enfants dans l'ordre
  DELETE FROM public.stop_times WHERE network_id = network_id_param;
  DELETE FROM public.transfers WHERE network_id = network_id_param;
  DELETE FROM public.trips WHERE network_id = network_id_param;
  DELETE FROM public.stops WHERE network_id = network_id_param;
  DELETE FROM public.shapes WHERE network_id = network_id_param;
  DELETE FROM public.routes WHERE network_id = network_id_param;
  DELETE FROM public.calendar_dates WHERE network_id = network_id_param;
  DELETE FROM public.calendar WHERE network_id = network_id_param;
  DELETE FROM public.agency WHERE network_id = network_id_param;
  
  -- Enfin, supprimer le réseau lui-même
  DELETE FROM public.networks WHERE network_id = network_id_param;

  -- Réactiver les contraintes
  SET session_replication_role = 'origin';

  -- Log l'opération
  RAISE NOTICE 'Forced deletion of network: %', network_id_param;
END;
$$; 