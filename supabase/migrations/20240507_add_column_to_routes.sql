-- Script pour ajouter la colonne route_sort_order à la table routes
-- Compatible avec PostgreSQL et MySQL

-- Pour PostgreSQL
DO $$ 
BEGIN 
  BEGIN
    ALTER TABLE routes ADD COLUMN route_sort_order INTEGER;
  EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'Column route_sort_order already exists in table routes.';
  END;
END $$;

-- Pour MySQL
-- Utiliser ce bloc si vous utilisez MySQL au lieu de PostgreSQL
/*
SET @sql = (
  SELECT IF(
    EXISTS(
      SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'routes' AND COLUMN_NAME = 'route_sort_order'
    ),
    'SELECT 1', -- Ne rien faire si la colonne existe déjà
    'ALTER TABLE routes ADD COLUMN route_sort_order INT'
  )
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
*/ 