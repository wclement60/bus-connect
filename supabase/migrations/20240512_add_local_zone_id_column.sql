-- Migration pour ajouter la colonne manquante 'local_zone_id' à la table stop_times
-- Cette colonne est attendue par le schéma mais n'existe pas dans la base de données

-- Ajouter la colonne 'local_zone_id' avec une valeur par défaut de NULL
ALTER TABLE IF EXISTS public.stop_times
ADD COLUMN IF NOT EXISTS local_zone_id text DEFAULT NULL;

-- Ajouter un commentaire sur la colonne
COMMENT ON COLUMN public.stop_times.local_zone_id IS 'Identifiant de la zone locale (GTFS-Flex)';

-- Log de l'action
DO $$
BEGIN
    RAISE NOTICE 'La colonne local_zone_id a été ajoutée à la table stop_times';
END $$; 