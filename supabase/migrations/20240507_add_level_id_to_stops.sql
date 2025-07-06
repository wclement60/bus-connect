-- Migration pour ajouter la colonne level_id à la table stops
-- Cette colonne est utilisée dans les standards GTFS plus récents pour les niveaux des stations

-- Ajout de la colonne level_id à la table stops si elle n'existe pas déjà
ALTER TABLE stops ADD COLUMN IF NOT EXISTS level_id TEXT;

-- Exécuter cette partie pour PostgreSQL
DO $$
BEGIN
    -- Vérifier si la colonne existe déjà
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'stops' AND column_name = 'level_id'
    ) THEN
        -- Si la colonne n'existe pas, on la crée
        ALTER TABLE stops ADD COLUMN level_id TEXT;
    END IF;
END $$;

-- Pour MySQL (décommenter si vous utilisez MySQL)
/*
SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'stops' AND COLUMN_NAME = 'level_id'
    ),
    'SELECT 1', -- Ne rien faire si la colonne existe déjà
    'ALTER TABLE stops ADD COLUMN level_id VARCHAR(255)'
  )
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
*/ 