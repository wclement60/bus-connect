-- Migration pour ajouter les colonnes relatives aux sous-réseaux aux tables GTFS
-- Cette migration ajoute subnetwork_name et subnetwork_metadata aux tables GTFS

DO $$
BEGIN
    -- Table agency
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agency' AND column_name = 'subnetwork_name'
    ) THEN
        ALTER TABLE agency ADD COLUMN subnetwork_name TEXT;
        COMMENT ON COLUMN agency.subnetwork_name IS 'Nom du sous-réseau auquel appartient cette agence';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agency' AND column_name = 'subnetwork_metadata'
    ) THEN
        ALTER TABLE agency ADD COLUMN subnetwork_metadata JSONB;
        COMMENT ON COLUMN agency.subnetwork_metadata IS 'Métadonnées du sous-réseau (informations temps réel, etc.)';
    END IF;

    -- Table routes
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'routes' AND column_name = 'subnetwork_name'
    ) THEN
        ALTER TABLE routes ADD COLUMN subnetwork_name TEXT;
        COMMENT ON COLUMN routes.subnetwork_name IS 'Nom du sous-réseau auquel appartient cette route';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'routes' AND column_name = 'subnetwork_metadata'
    ) THEN
        ALTER TABLE routes ADD COLUMN subnetwork_metadata JSONB;
        COMMENT ON COLUMN routes.subnetwork_metadata IS 'Métadonnées du sous-réseau (informations temps réel, etc.)';
    END IF;

    -- Table stops
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'stops' AND column_name = 'subnetwork_name'
    ) THEN
        ALTER TABLE stops ADD COLUMN subnetwork_name TEXT;
        COMMENT ON COLUMN stops.subnetwork_name IS 'Nom du sous-réseau auquel appartient cet arrêt';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'stops' AND column_name = 'subnetwork_metadata'
    ) THEN
        ALTER TABLE stops ADD COLUMN subnetwork_metadata JSONB;
        COMMENT ON COLUMN stops.subnetwork_metadata IS 'Métadonnées du sous-réseau (informations temps réel, etc.)';
    END IF;

    -- Table trips
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'subnetwork_name'
    ) THEN
        ALTER TABLE trips ADD COLUMN subnetwork_name TEXT;
        COMMENT ON COLUMN trips.subnetwork_name IS 'Nom du sous-réseau auquel appartient ce trajet';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'subnetwork_metadata'
    ) THEN
        ALTER TABLE trips ADD COLUMN subnetwork_metadata JSONB;
        COMMENT ON COLUMN trips.subnetwork_metadata IS 'Métadonnées du sous-réseau (informations temps réel, etc.)';
    END IF;

    -- Table calendar
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'calendar' AND column_name = 'subnetwork_name'
    ) THEN
        ALTER TABLE calendar ADD COLUMN subnetwork_name TEXT;
        COMMENT ON COLUMN calendar.subnetwork_name IS 'Nom du sous-réseau auquel appartient ce calendrier';
    END IF;

    -- Table calendar_dates
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'calendar_dates' AND column_name = 'subnetwork_name'
    ) THEN
        ALTER TABLE calendar_dates ADD COLUMN subnetwork_name TEXT;
        COMMENT ON COLUMN calendar_dates.subnetwork_name IS 'Nom du sous-réseau auquel appartient cette date de calendrier';
    END IF;

    -- Table shapes
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'shapes' AND column_name = 'subnetwork_name'
    ) THEN
        ALTER TABLE shapes ADD COLUMN subnetwork_name TEXT;
        COMMENT ON COLUMN shapes.subnetwork_name IS 'Nom du sous-réseau auquel appartient cette forme';
    END IF;

    -- Table stop_times
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'stop_times' AND column_name = 'subnetwork_name'
    ) THEN
        ALTER TABLE stop_times ADD COLUMN subnetwork_name TEXT;
        COMMENT ON COLUMN stop_times.subnetwork_name IS 'Nom du sous-réseau auquel appartient cet horaire';
    END IF;

    -- Table transfers
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transfers' AND column_name = 'subnetwork_name'
    ) THEN
        ALTER TABLE transfers ADD COLUMN subnetwork_name TEXT;
        COMMENT ON COLUMN transfers.subnetwork_name IS 'Nom du sous-réseau auquel appartient ce transfert';
    END IF;

END $$; 