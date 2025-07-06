-- First, drop the old function signature if it exists, to avoid conflicts.
-- The old signature had 3 arguments.
DROP FUNCTION IF EXISTS get_route_map_data(TEXT, TEXT, TEXT);

-- Function to get a representative route shape and stops for map display.
-- It can now work with a specific trip_id to get the exact shape,
-- or fall back to the most common shape for a route/direction.
CREATE OR REPLACE FUNCTION get_route_map_data(
  p_network_id TEXT,
  p_route_id TEXT,
  p_direction_id TEXT DEFAULT NULL,
  p_trip_id TEXT DEFAULT NULL -- New parameter for specific trip
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  route_info JSONB;
  stops JSONB;
  shape_data JSONB;
  target_shape_id TEXT;
  target_trip_id TEXT;
BEGIN
  -- Get route information (color, name, etc.)
  SELECT jsonb_build_object(
    'route_id', r.route_id,
    'route_short_name', r.route_short_name,
    'route_long_name', r.route_long_name,
    'route_color', r.route_color,
    'route_text_color', r.route_text_color
  ) INTO route_info
  FROM routes r
  WHERE r.network_id = p_network_id AND r.route_id = p_route_id;

  -- Determine the target shape_id. Prioritize the specific trip if provided.
  IF p_trip_id IS NOT NULL THEN
    SELECT t.shape_id INTO target_shape_id
    FROM trips t
    WHERE t.network_id = p_network_id AND t.trip_id = p_trip_id;
    target_trip_id := p_trip_id; -- The target trip is the one provided
  ELSE
    -- Fallback to the most representative shape_id for the route and direction
    SELECT t.shape_id INTO target_shape_id
    FROM trips t
    WHERE t.network_id = p_network_id
      AND t.route_id = p_route_id
      AND (p_direction_id IS NULL OR t.direction_id = p_direction_id::INTEGER)
      AND t.shape_id IS NOT NULL
    GROUP BY t.shape_id
    ORDER BY COUNT(*) DESC, t.shape_id -- Add secondary sort for deterministic result
    LIMIT 1;
  END IF;

  -- Get the shape data for the selected shape_id
  IF target_shape_id IS NOT NULL THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'lat', sh.shape_pt_lat,
        'lon', sh.shape_pt_lon
      ) ORDER BY sh.shape_pt_sequence
    ) INTO shape_data
    FROM shapes sh
    WHERE sh.network_id = p_network_id AND sh.shape_id = target_shape_id;
  ELSE
    shape_data := '[]'::jsonb;
  END IF;

  -- To get a consistent list of stops, we find a representative trip
  -- that uses our target shape, unless a specific trip was already provided.
  IF target_trip_id IS NULL AND target_shape_id IS NOT NULL THEN
      SELECT trip_id INTO target_trip_id FROM trips
      WHERE network_id = p_network_id AND shape_id = target_shape_id
      LIMIT 1;
  END IF;

  -- If we have a target trip (either provided or found), get its stops.
  IF target_trip_id IS NOT NULL THEN
      SELECT jsonb_agg(
        jsonb_build_object(
          'stop_id', s.stop_id,
          'stop_name', s.stop_name,
          'stop_lat', s.stop_lat,
          'stop_lon', s.stop_lon
        ) ORDER BY st.stop_sequence
      ) INTO stops
      FROM stop_times st
      JOIN stops s ON s.stop_id = st.stop_id AND s.network_id = p_network_id
      WHERE st.network_id = p_network_id AND st.trip_id = target_trip_id;
  ELSE
    stops := '[]'::jsonb;
  END IF;

  -- Build the final result
  result := jsonb_build_object(
    'route', route_info,
    'stops', COALESCE(stops, '[]'::jsonb),
    'shape', COALESCE(shape_data, '[]'::jsonb)
  );
  
  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_route_map_data TO authenticated, anon;

-- Comment for the function
COMMENT ON FUNCTION get_route_map_data IS 'Get route shape and stops for map display, for a specific trip or the most common variant.'; 