-- Migration pour ajouter la colonne manquante 'pickup_booking_rule_id' à la table stop_times
-- Cette colonne est attendue par le schéma mais n'existe pas dans la base de données

-- Ajouter la colonne 'pickup_booking_rule_id' avec une valeur par défaut de NULL
ALTER TABLE IF EXISTS public.stop_times
ADD COLUMN IF NOT EXISTS pickup_booking_rule_id text DEFAULT NULL;

-- Ajouter un commentaire sur la colonne
COMMENT ON COLUMN public.stop_times.pickup_booking_rule_id IS 'Identifiant de la règle de réservation pour le pickup (GTFS-Flex)';

-- Log de l'action
DO $$
BEGIN
    RAISE NOTICE 'La colonne pickup_booking_rule_id a été ajoutée à la table stop_times';
END $$; 