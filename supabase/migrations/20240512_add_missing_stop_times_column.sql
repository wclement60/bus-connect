-- Migration pour ajouter les colonnes manquantes à la table stop_times
-- Ces colonnes sont attendues par le schéma mais n'existent pas dans la base de données

-- Ajouter la colonne 'end_pickup_drop_off_window' avec une valeur par défaut de NULL
ALTER TABLE IF EXISTS public.stop_times
ADD COLUMN IF NOT EXISTS end_pickup_drop_off_window text DEFAULT NULL;

-- Ajouter la colonne 'local_zone_id' avec une valeur par défaut de NULL
ALTER TABLE IF EXISTS public.stop_times
ADD COLUMN IF NOT EXISTS local_zone_id text DEFAULT NULL;

-- Ajouter des commentaires sur les colonnes
COMMENT ON COLUMN public.stop_times.end_pickup_drop_off_window IS 'Fin de la fenêtre de temps pour les pickups/drop-offs (GTFS-Flex)';
COMMENT ON COLUMN public.stop_times.local_zone_id IS 'Identifiant de la zone locale (GTFS-Flex)';

-- Log de l'action
DO $$
BEGIN
    RAISE NOTICE 'Les colonnes end_pickup_drop_off_window et local_zone_id ont été ajoutées à la table stop_times';
END $$; 