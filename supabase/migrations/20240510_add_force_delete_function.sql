-- Migration pour ajouter la fonction de suppression forcée de réseau
-- Cette migration crée une fonction PostgreSQL qui permet de contourner les contraintes de clé étrangère
-- pour effectuer une suppression forcée d'un réseau et de toutes ses données associées

-- Force Delete Network Function
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

-- Ajouter des commentaires pour la fonction
COMMENT ON FUNCTION public.force_delete_network IS 'Fonction pour forcer la suppression d''un réseau et de toutes ses données associées en contournant les contraintes de clé étrangère';

-- Ajouter les permissions pour la fonction
-- Note: cela permet d'appeler cette fonction via l'API REST Supabase
GRANT EXECUTE ON FUNCTION public.force_delete_network TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_delete_network TO service_role; 