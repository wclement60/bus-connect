-- Add etat column to routes table
ALTER TABLE routes ADD COLUMN etat smallint NOT NULL DEFAULT 1;

-- Update all existing records to have etat = 1
UPDATE routes SET etat = 1 WHERE etat IS NULL;

-- Add comment to explain the column
COMMENT ON COLUMN routes.etat IS 'État de la ligne: 0 = désactivée, 1 = activée'; 