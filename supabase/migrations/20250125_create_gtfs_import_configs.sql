-- Création de la table de configuration pour les imports GTFS automatiques
CREATE TABLE IF NOT EXISTS gtfs_import_configs (
    id SERIAL PRIMARY KEY,
    network_id TEXT NOT NULL,
    api_url TEXT NOT NULL,
    dataset_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    auto_import_enabled BOOLEAN NOT NULL DEFAULT false,
    import_interval_hours INTEGER DEFAULT 24,
    last_import_date TIMESTAMP WITH TIME ZONE,
    last_import_result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT unique_network_config UNIQUE (network_id),
    CONSTRAINT positive_interval CHECK (import_interval_hours > 0)
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_gtfs_import_configs_network_id ON gtfs_import_configs(network_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_import_configs_auto_enabled ON gtfs_import_configs(auto_import_enabled);
CREATE INDEX IF NOT EXISTS idx_gtfs_import_configs_last_import ON gtfs_import_configs(last_import_date);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_gtfs_import_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gtfs_import_configs_updated_at_trigger
    BEFORE UPDATE ON gtfs_import_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_gtfs_import_configs_updated_at();

-- Commentaires pour documenter la table
COMMENT ON TABLE gtfs_import_configs IS 'Configuration pour les imports GTFS automatiques depuis transport.data.gouv.fr';
COMMENT ON COLUMN gtfs_import_configs.network_id IS 'Identifiant unique du réseau de transport';
COMMENT ON COLUMN gtfs_import_configs.api_url IS 'URL de l''API transport.data.gouv.fr pour ce dataset';
COMMENT ON COLUMN gtfs_import_configs.dataset_id IS 'Identifiant du dataset sur transport.data.gouv.fr';
COMMENT ON COLUMN gtfs_import_configs.resource_id IS 'Identifiant de la ressource GTFS sur transport.data.gouv.fr';
COMMENT ON COLUMN gtfs_import_configs.auto_import_enabled IS 'Indique si l''import automatique est activé';
COMMENT ON COLUMN gtfs_import_configs.import_interval_hours IS 'Intervalle en heures entre les imports automatiques';
COMMENT ON COLUMN gtfs_import_configs.last_import_date IS 'Date et heure du dernier import réussi';
COMMENT ON COLUMN gtfs_import_configs.last_import_result IS 'Résultat JSON du dernier import (succès/erreur, statistiques)';

-- Insertion d'un exemple de configuration pour le réseau "Le Bus" (Estérel Côte d'Azur)
INSERT INTO gtfs_import_configs (
    network_id,
    api_url,
    dataset_id,
    resource_id,
    auto_import_enabled,
    import_interval_hours
) VALUES (
    'le-bus-esterel',
    'https://transport.data.gouv.fr/api/datasets/66f2e97fc41001275c716d9f',
    '66f2e97fc41001275c716d9f',
    '82294',
    false, -- Désactivé par défaut, à activer manuellement
    24 -- Import toutes les 24 heures
) ON CONFLICT (network_id) DO NOTHING; 