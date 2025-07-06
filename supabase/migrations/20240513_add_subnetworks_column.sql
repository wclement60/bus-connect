-- Migration pour ajouter la colonne subnetworks à la table networks
-- Cette colonne stockera les informations sur les sous-réseaux en format JSONB

-- Vérifier si la colonne existe déjà
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'networks'
        AND column_name = 'subnetworks'
    ) THEN
        -- Ajouter la colonne subnetworks de type JSONB
        ALTER TABLE networks ADD COLUMN subnetworks JSONB;
        
        -- Commentaire pour documenter le format attendu
        COMMENT ON COLUMN networks.subnetworks IS 'Tableau d''objets JSON contenant les informations sur les sous-réseaux. Format: [{name: "nom_sous_reseau", realtime: {type: "siri", url: "...", api_key: "..."}}]';
    END IF;
END $$; 