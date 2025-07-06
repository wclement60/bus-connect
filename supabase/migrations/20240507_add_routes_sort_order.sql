-- Migration pour ajouter la colonne route_sort_order à la table routes
-- Cette colonne est utilisée dans les standards GTFS plus récents pour trier les lignes

-- Ajout de la colonne route_sort_order à la table routes si elle n'existe pas déjà
ALTER TABLE routes ADD COLUMN IF NOT EXISTS route_sort_order INTEGER;

-- Ajout d'un index pour améliorer les performances de tri
CREATE INDEX IF NOT EXISTS idx_routes_sort_order ON routes(route_sort_order);

-- Renommer la colonne display_order en route_sort_order pour les données existantes
DO $$
BEGIN
    -- Vérifier si la colonne display_order existe
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'routes' AND column_name = 'display_order'
    ) THEN
        -- Si les deux colonnes existent, on copie les données de display_order vers route_sort_order
        UPDATE routes SET route_sort_order = display_order 
        WHERE route_sort_order IS NULL AND display_order IS NOT NULL;
    END IF;
END $$; 