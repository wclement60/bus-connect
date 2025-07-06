-- Migration pour ajouter les colonnes de règles de réservation à la table stop_times
-- Ces colonnes sont utilisées dans les standards GTFS plus récents pour la réservation de voyages à la demande

-- Ajout de la colonne drop_off_booking_rule_id à la table stop_times si elle n'existe pas déjà
ALTER TABLE stop_times ADD COLUMN IF NOT EXISTS drop_off_booking_rule_id TEXT;

-- Exécuter cette partie pour PostgreSQL
DO $$
BEGIN
    -- Vérifier si la colonne existe déjà
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'stop_times' AND column_name = 'drop_off_booking_rule_id'
    ) THEN
        -- Si la colonne n'existe pas, on la crée
        ALTER TABLE stop_times ADD COLUMN drop_off_booking_rule_id TEXT;
    END IF;
END $$;

-- Pour MySQL (décommenter si vous utilisez MySQL)
/*
SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'stop_times' AND COLUMN_NAME = 'drop_off_booking_rule_id'
    ),
    'SELECT 1', -- Ne rien faire si la colonne existe déjà
    'ALTER TABLE stop_times ADD COLUMN drop_off_booking_rule_id VARCHAR(255)'
  )
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
*/ 