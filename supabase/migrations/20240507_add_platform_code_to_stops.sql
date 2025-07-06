-- Migration pour ajouter la colonne platform_code à la table stops
-- Cette colonne est utilisée dans les standards GTFS plus récents pour les codes de quai

-- Ajout de la colonne platform_code à la table stops si elle n'existe pas déjà
ALTER TABLE stops ADD COLUMN IF NOT EXISTS platform_code TEXT;

-- Exécuter cette partie pour PostgreSQL
DO $$
BEGIN
    -- Vérifier si la colonne existe déjà
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'stops' AND column_name = 'platform_code'
    ) THEN
        -- Si la colonne n'existe pas, on la crée
        ALTER TABLE stops ADD COLUMN platform_code TEXT;
    END IF;
END $$;

-- Pour MySQL (décommenter si vous utilisez MySQL)
/*
SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'stops' AND COLUMN_NAME = 'platform_code'
    ),
    'SELECT 1', -- Ne rien faire si la colonne existe déjà
    'ALTER TABLE stops ADD COLUMN platform_code VARCHAR(255)'
  )
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
*/ 