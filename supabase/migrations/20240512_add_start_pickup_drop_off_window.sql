-- Migration pour ajouter la colonne manquante 'start_pickup_drop_off_window' à la table stop_times
-- Cette colonne est attendue par le schéma mais n'existe pas dans la base de données

-- Ajouter la colonne 'start_pickup_drop_off_window' avec une valeur par défaut de NULL
ALTER TABLE IF EXISTS public.stop_times
ADD COLUMN IF NOT EXISTS start_pickup_drop_off_window text DEFAULT NULL;

-- Ajouter un commentaire sur la colonne
COMMENT ON COLUMN public.stop_times.start_pickup_drop_off_window IS 'Début de la fenêtre de temps pour les pickups/drop-offs (GTFS-Flex)';

-- Log de l'action
DO $$
BEGIN
    RAISE NOTICE 'La colonne start_pickup_drop_off_window a été ajoutée à la table stop_times';
END $$; 