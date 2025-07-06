-- Migration pour ajouter la colonne network_code à la table agency
-- Cette colonne contiendra l'ID du réseau de l'API de perturbations (ex: AXO = 51)

DO $$
BEGIN
    -- Ajouter la colonne network_code si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agency' AND column_name = 'network_code'
    ) THEN
        ALTER TABLE agency ADD COLUMN network_code INTEGER;
    END IF;
END $$;

-- Ajouter le commentaire séparément pour éviter les problèmes d'échappement
COMMENT ON COLUMN agency.network_code IS 'ID du reseau dans API de perturbations Oise Mobilite'; 