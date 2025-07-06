-- supabase/migrations/$(date +%Y%m%d%H%M%S)_add_selective_delete_gtfs_data_function.sql
-- Make sure the timestamp in the filename is unique and current.

CREATE OR REPLACE FUNCTION public.selective_delete_gtfs_data(
    p_network_id TEXT,
    p_tables_to_delete TEXT[]
)
RETURNS JSONB AS $$
DECLARE
    result JSONB = '{"success": true, "details": [], "overall_message": ""}'::JSONB;
    table_name_var TEXT;
    deleted_count BIGINT;
    current_detail JSONB;
    error_message TEXT;
    error_context TEXT;
    original_session_replication_role TEXT;
    all_successful BOOLEAN := true;
BEGIN
    -- Validate network_id (optional, but good practice)
    IF NOT EXISTS (SELECT 1 FROM public.networks WHERE network_id = p_network_id) THEN
        RETURN jsonb_build_object(
            'success', false, 
            'overall_message', 'Network not found: ' || COALESCE(p_network_id, 'NULL'),
            'details', '[]'::JSONB
        );
    END IF;

    IF p_tables_to_delete IS NULL OR array_length(p_tables_to_delete, 1) IS NULL THEN
        RETURN jsonb_build_object(
            'success', true, -- Or false, depending on desired behavior for empty list
            'overall_message', 'No tables specified for data deletion.',
            'details', '[]'::JSONB
        );
    END IF;

    -- Save and modify session replication role to disable foreign key checks and triggers temporarily
    SELECT current_setting('session_replication_role') INTO original_session_replication_role;
    SET session_replication_role = 'replica';

    FOREACH table_name_var IN ARRAY p_tables_to_delete LOOP
        BEGIN
            RAISE NOTICE 'Deleting data from table: % for network_id: %', table_name_var, p_network_id;
            EXECUTE format('DELETE FROM public.%I WHERE network_id = $1', table_name_var) USING p_network_id;
            GET DIAGNOSTICS deleted_count = ROW_COUNT;
            
            current_detail := jsonb_build_object(
                'table', table_name_var,
                'deleted_rows', deleted_count,
                'status', 'success'
            );
            result := jsonb_set(result, '{details, -1}', current_detail, true);
            RAISE NOTICE 'Deleted % rows from table: %', deleted_count, table_name_var;

        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT, error_context = PG_EXCEPTION_CONTEXT;
            current_detail := jsonb_build_object(
                'table', table_name_var,
                'status', 'error',
                'deleted_rows', 0,
                'error_message', error_message,
                'error_context', error_context
            );
            result := jsonb_set(result, '{details, -1}', current_detail, true);
            result := jsonb_set(result, '{success}', 'false'::JSONB); -- Mark overall failure
            all_successful := false;
            RAISE WARNING 'Error deleting from table %: %, Context: %', table_name_var, error_message, error_context;
        END;
    END LOOP;

    -- Restore session replication role
    EXECUTE format('SET session_replication_role = %L', original_session_replication_role);

    IF all_successful THEN
        result := jsonb_set(result, '{overall_message}', 'Selective data deletion completed successfully.'::JSONB);
    ELSE
        result := jsonb_set(result, '{overall_message}', 'Selective data deletion completed with one or more errors.'::JSONB);
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Example of how to call (run this in SQL editor after creating the function):
-- SELECT public.selective_delete_gtfs_data('YOUR_NETWORK_ID', ARRAY['stop_times', 'trips']); 