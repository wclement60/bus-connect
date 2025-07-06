-- Supprimer toutes les versions possibles de la fonction
DROP FUNCTION IF EXISTS horaires_get_timeline(text, text, text, text, text, text);

-- Créer la nouvelle version avec des types précis
CREATE OR REPLACE FUNCTION horaires_get_timeline(
  p_network_id text,
  p_route_id text,
  p_direction_id text,
  p_current_time text,
  p_current_date text,
  p_day_of_week text
)
RETURNS TABLE (
  stop_id text,
  stop_name text,
  departure_time text,
  stop_sequence integer,
  connections jsonb,
  debug_info jsonb
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_trip_count integer;
  v_next_trip_id text;
  v_debug_info jsonb;
  v_current_time time;
  v_is_after_midnight boolean;
  v_service_count integer;
  v_stop_ids text[];
  v_connections jsonb;
BEGIN
  -- Initialiser le debug_info
  v_debug_info := jsonb_build_object(
    'params', jsonb_build_object(
      'network_id', p_network_id,
      'route_id', p_route_id,
      'direction_id', p_direction_id,
      'current_time', p_current_time,
      'current_date', p_current_date,
      'day_of_week', p_day_of_week
    )
  );

  -- Convertir l'heure actuelle en type time
  v_current_time := p_current_time::time;
  
  -- Déterminer si nous sommes après minuit
  v_is_after_midnight := v_current_time < '05:00:00'::time;

  -- Vérifier les trips disponibles
  SELECT COUNT(*) INTO v_trip_count
  FROM trips t
  WHERE t.network_id = p_network_id
  AND t.route_id = p_route_id;

  v_debug_info := v_debug_info || jsonb_build_object('total_trips_count', v_trip_count);

  -- Compter les services actifs pour cette date (calendrier normal + ajouts par exception)
  SELECT COUNT(*) INTO v_service_count FROM (
    -- Services du calendrier normal
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
    
    -- Services ajoutés par exception
    SELECT cd.service_id
    FROM calendar_dates cd
    WHERE cd.network_id = p_network_id
      AND cd.date = p_current_date::date
      AND cd.exception_type = 1
  ) AS active_services;
  
  v_debug_info := v_debug_info || jsonb_build_object('active_services_count', v_service_count);
  
  -- Si aucun service n'est actif, sortir avec un message
  IF v_service_count = 0 THEN
    v_debug_info := v_debug_info || jsonb_build_object('message', 'Aucun service disponible pour cette date');
    RETURN QUERY
    SELECT 
      NULL::text as stop_id,
      NULL::text as stop_name,
      NULL::text as departure_time,
      NULL::integer as stop_sequence,
      NULL::jsonb as connections,
      v_debug_info;
    RETURN;
  END IF;

  -- Trouver le prochain trip avec une CTE qui utilise les services actifs
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
  next_departure AS (
    SELECT 
      t.trip_id,
      MIN(
        CASE 
          WHEN st.departure_time ~ '^2[4-9]:|^3[0-9]:' THEN normalize_time(st.departure_time)
          ELSE st.departure_time::time
        END
      ) as first_departure,
      MIN(st.departure_time) as original_departure_time
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
    GROUP BY t.trip_id
    HAVING (
      CASE
        WHEN v_is_after_midnight THEN 
          MIN(CASE 
            WHEN st.departure_time ~ '^2[4-9]:|^3[0-9]:' THEN normalize_time(st.departure_time)
            ELSE st.departure_time::time
          END) >= v_current_time
          OR MIN(st.departure_time) ~ '^2[4-9]:|^3[0-9]:'
        ELSE 
          MIN(CASE 
            WHEN st.departure_time ~ '^2[4-9]:|^3[0-9]:' THEN normalize_time(st.departure_time)
            ELSE st.departure_time::time
          END) >= v_current_time
          AND MIN(st.departure_time) !~ '^2[4-9]:|^3[0-9]:'
      END
    )
  )
  SELECT trip_id INTO v_next_trip_id
  FROM next_departure
  ORDER BY first_departure
  LIMIT 1;

  v_debug_info := v_debug_info || jsonb_build_object('next_trip_id', v_next_trip_id);

  -- Si on a trouvé un trip, récupérer ses arrêts et leurs correspondances
  IF v_next_trip_id IS NOT NULL THEN
    -- Récupérer d'abord les IDs des arrêts pour ce trip
    SELECT array_agg(st.stop_id ORDER BY st.stop_sequence)
    INTO v_stop_ids
    FROM stop_times st
    WHERE st.trip_id = v_next_trip_id;

    -- Créer une table temporaire pour stocker les IDs d'arrêts avec leurs variantes
    CREATE TEMP TABLE temp_stop_ids AS
    WITH RECURSIVE stop_id_variants AS (
      -- Version de base
      SELECT unnest(v_stop_ids) as stop_id
      UNION
      -- Version sans préfixe départemental
      SELECT COALESCE(split_part(stop_id, ':', 2), stop_id)
      FROM (SELECT unnest(v_stop_ids) as stop_id) s
      WHERE stop_id LIKE '%:%'
      UNION
      -- Versions avec différents préfixes départementaux
      SELECT prefix || ':' || COALESCE(split_part(stop_id, ':', 2), stop_id)
      FROM (SELECT unnest(v_stop_ids) as stop_id) s
      CROSS JOIN (
        SELECT unnest(ARRAY['60', '95', '75', '77', '78', '91', '92', '93', '94']) as prefix
      ) p
      WHERE NOT (stop_id LIKE '%:%' AND split_part(stop_id, ':', 1) = prefix)
    )
    SELECT DISTINCT stop_id FROM stop_id_variants;

    -- Créer un index sur la table temporaire pour accélérer les recherches
    CREATE INDEX ON temp_stop_ids (stop_id);

    -- Récupérer toutes les correspondances en une seule requête
    WITH stop_routes AS (
      SELECT DISTINCT
        st.stop_id,
        r.route_id,
        r.route_short_name,
        r.route_color,
        r.route_text_color,
        -- Utiliser row_number pour dédupliquer les lignes par arrêt
        ROW_NUMBER() OVER (
          PARTITION BY st.stop_id, r.route_id 
          ORDER BY r.route_short_name
        ) as rn
      FROM temp_stop_ids tsi
      JOIN stop_times st ON st.stop_id = tsi.stop_id
      JOIN trips t ON t.trip_id = st.trip_id AND t.network_id = st.network_id
      JOIN routes r ON r.route_id = t.route_id AND r.network_id = t.network_id
      WHERE r.network_id = p_network_id
        AND r.route_id != p_route_id  -- Exclure la ligne actuelle
    ),
    grouped_routes AS (
      -- Ne garder que la première occurrence de chaque ligne par arrêt
      SELECT 
        stop_id,
        jsonb_agg(
          jsonb_build_object(
            'route_id', route_id,
            'route_short_name', route_short_name,
            'route_color', route_color,
            'route_text_color', route_text_color
          )
          ORDER BY route_short_name
        ) as connections
      FROM stop_routes
      WHERE rn = 1
      GROUP BY stop_id
    )
    SELECT 
      jsonb_object_agg(
        COALESCE(gr.stop_id, sid.stop_id),
        COALESCE(gr.connections, '[]'::jsonb)
      )
    INTO v_connections
    FROM (SELECT unnest(v_stop_ids) as stop_id) sid
    LEFT JOIN grouped_routes gr ON gr.stop_id = sid.stop_id
    OR gr.stop_id = COALESCE(split_part(sid.stop_id, ':', 2), sid.stop_id)
    OR gr.stop_id LIKE '%:' || COALESCE(split_part(sid.stop_id, ':', 2), sid.stop_id);

    -- Nettoyer
    DROP TABLE temp_stop_ids;

    -- Retourner les arrêts avec leurs correspondances
    RETURN QUERY
    SELECT 
      s.stop_id,
      s.stop_name,
      st.departure_time::text,
      st.stop_sequence,
      COALESCE(v_connections->s.stop_id, '[]'::jsonb),
      v_debug_info
    FROM stop_times st
    JOIN stops s ON st.stop_id = s.stop_id
    JOIN trips t ON st.trip_id = t.trip_id
    WHERE st.trip_id = v_next_trip_id
    AND t.network_id = p_network_id
    AND s.network_id = p_network_id
    ORDER BY st.stop_sequence;
  ELSE
    -- Si aucun trip n'est trouvé, retourner quand même les infos de debug
    RETURN QUERY
    SELECT 
      NULL::text as stop_id,
      NULL::text as stop_name,
      NULL::text as departure_time,
      NULL::integer as stop_sequence,
      NULL::jsonb as connections,
      v_debug_info;
  END IF;
END;
$$; 