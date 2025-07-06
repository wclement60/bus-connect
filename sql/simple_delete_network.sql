-- Fonction optimisée pour supprimer efficacement et rapidement un réseau entier
-- Cette fonction utilise des techniques avancées pour gérer des millions d'enregistrements
-- et contourner les contraintes de clés étrangères pour une suppression ultra-rapide

CREATE OR REPLACE FUNCTION public.simple_delete_network(network_id_param TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB = '{"success": true, "details": [], "successes": [], "errors": []}'::JSONB;
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  execution_time TEXT;
  table_start_time TIMESTAMPTZ;
  table_end_time TIMESTAMPTZ;
  table_execution_time TEXT;
  table_record RECORD;
  table_exists BOOLEAN;
  deleted_count BIGINT;
  has_error BOOLEAN := false;
  error_info TEXT;
BEGIN
  -- Mesurer le temps d'exécution global
  start_time = clock_timestamp();
  
  -- Vérifier si le réseau existe
  PERFORM 1 FROM networks WHERE network_id = network_id_param;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Network not found',
      'message', 'Le réseau spécifié n\'existe pas'
    );
  END IF;
  
  -- Désactiver temporairement les contraintes de clé étrangère
  SET session_replication_role = 'replica';
  
  -- Augmenter la mémoire de travail et autres paramètres pour optimiser les performances
  SET work_mem TO 524288;          -- 512MB en kB
  SET maintenance_work_mem TO 2097152;  -- 2GB en kB
  
  -- Augmenter le timeout de requête (60 minutes)
  SET statement_timeout TO 3600000;     -- 1 heure en ms
  
  -- Tableau des tables GTFS dans l'ordre optimal de suppression
  FOR table_record IN 
    SELECT table_name 
    FROM (VALUES 
      ('stop_times', 1),     -- Généralement la plus volumineuse, à supprimer en premier
      ('shapes', 2),         -- Souvent très volumineuse
      ('trips', 3),
      ('transfers', 4),
      ('frequencies', 5),
      ('fare_rules', 6),
      ('fare_attributes', 7),
      ('stops', 8),
      ('routes', 9),
      ('calendar_dates', 10),
      ('calendar', 11),
      ('agency', 12),
      ('favorite_stops', 13),
      ('favorite_lines', 14),
      ('favorite_networks', 15),
      ('delayed_trips', 16),
      ('networks', 17)       -- Toujours en dernier
    ) AS t(table_name, sort_order)
    ORDER BY sort_order
  LOOP
    -- Vérifier si la table existe
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = table_record.table_name
    ) INTO table_exists;
    
    IF table_exists THEN
      table_start_time = clock_timestamp();
      has_error = false;
      
      BEGIN
        -- Utiliser TRUNCATE avec CASCADE si c'est la table networks
        IF table_record.table_name = 'networks' THEN
          EXECUTE format('DELETE FROM %I WHERE network_id = $1', table_record.table_name)
          USING network_id_param;
        ELSE
          -- Pour toutes les autres tables, utiliser DELETE sans RETURNING pour économiser de la mémoire
          EXECUTE format('DELETE FROM %I WHERE network_id = $1', table_record.table_name)
          USING network_id_param;
        END IF;
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        table_end_time = clock_timestamp();
        table_execution_time = (extract(epoch from table_end_time) - extract(epoch from table_start_time))::TEXT || ' seconds';
        
        -- Enregistrer les détails de la suppression
        IF deleted_count > 0 THEN
          result = jsonb_set(result, '{details}', result->'details' || jsonb_build_object(
            'table', table_record.table_name,
            'deleted', deleted_count,
            'execution_time', table_execution_time
          )::jsonb);
          
          result = jsonb_set(result, '{successes}', result->'successes' || jsonb_build_object(
            'table', table_record.table_name,
            'deleted', deleted_count,
            'execution_time', table_execution_time
          )::jsonb);
        END IF;
        
      EXCEPTION WHEN OTHERS THEN
        has_error = true;
        error_info = SQLERRM;
        
        -- Enregistrer l'erreur
        result = jsonb_set(result, '{details}', result->'details' || jsonb_build_object(
          'table', table_record.table_name,
          'error', error_info
        )::jsonb);
        
        result = jsonb_set(result, '{errors}', result->'errors' || jsonb_build_object(
          'table', table_record.table_name,
          'error', error_info
        )::jsonb);
      END;
    END IF;
  END LOOP;
  
  -- Réactiver les contraintes
  SET session_replication_role = 'origin';
  
  -- Calculer le temps d'exécution global
  end_time = clock_timestamp();
  execution_time = (extract(epoch from end_time) - extract(epoch from start_time))::TEXT || ' seconds';
  
  -- Ajouter le temps d'exécution au résultat
  result = jsonb_set(result, '{execution_time}', to_jsonb(execution_time));
  
  -- Vérifier s'il y a eu des erreurs
  IF (result->'errors') IS NOT NULL AND jsonb_array_length(result->'errors') > 0 THEN
    -- Si l'erreur concerne uniquement des tables non essentielles, considérer comme un succès partiel
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(result->'errors') AS e
      WHERE e->>'table' IN ('networks', 'routes', 'stops', 'trips', 'stop_times')
    ) THEN
      result = jsonb_set(result, '{success}', 'true'::jsonb);
      result = jsonb_set(result, '{message}', to_jsonb('Suppression réussie avec des avertissements mineurs'));
    ELSE
      result = jsonb_set(result, '{success}', 'false'::jsonb);
      result = jsonb_set(result, '{message}', to_jsonb('Erreurs lors de la suppression de tables importantes'));
    END IF;
  END IF;
  
  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  -- Réactiver les contraintes en cas d'erreur
  SET session_replication_role = 'origin';
  
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Erreur critique lors de la suppression du réseau'
  );
END;
$$ LANGUAGE plpgsql; 