-- Création de la table de logs pour les jobs cron GTFS
CREATE TABLE IF NOT EXISTS gtfs_cron_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    total_configs INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    results JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_gtfs_cron_logs_timestamp ON gtfs_cron_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_gtfs_cron_logs_created_at ON gtfs_cron_logs(created_at);

-- Commentaires pour documenter la table
COMMENT ON TABLE gtfs_cron_logs IS 'Logs des exécutions des jobs cron d''import GTFS automatique';
COMMENT ON COLUMN gtfs_cron_logs.timestamp IS 'Horodatage de l''exécution du job cron';
COMMENT ON COLUMN gtfs_cron_logs.total_configs IS 'Nombre total de configurations traitées';
COMMENT ON COLUMN gtfs_cron_logs.success_count IS 'Nombre d''imports réussis';
COMMENT ON COLUMN gtfs_cron_logs.error_count IS 'Nombre d''imports en erreur';
COMMENT ON COLUMN gtfs_cron_logs.results IS 'Détails JSON des résultats pour chaque réseau';

-- Politique de rétention : garder les logs pendant 90 jours
-- (À configurer avec un job de nettoyage séparé)
CREATE OR REPLACE FUNCTION cleanup_old_gtfs_cron_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM gtfs_cron_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql; 