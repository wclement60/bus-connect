-- Script pour appliquer les migrations dans Supabase
-- Exécutez ce script dans l'interface SQL de Supabase

-- Inclure le script de création des tables utilisateurs
\i 'supabase/migrations/create_users_tables.sql'

-- Autres migrations
\i 'supabase/migrations/20240513_add_subnetworks_column.sql'
\i 'supabase/migrations/20240513_add_subnetwork_columns_to_gtfs_tables.sql'
\i 'supabase/migrations/20240601_create_contact_requests.sql'

-- Afficher les tables créées
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND table_name IN ('users', 'user_preferences', 'user_history', 'contact_requests');

-- Ajout de la table de voyages supprimés
CREATE TABLE IF NOT EXISTS cancelled_trips (
  id SERIAL PRIMARY KEY,
  network_id TEXT REFERENCES networks(network_id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL,
  cancellation_date DATE NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Contrainte unique pour éviter les doublons
  UNIQUE(network_id, trip_id, cancellation_date),
  
  -- Contrainte de référence vers la table trips
  FOREIGN KEY (trip_id, network_id) REFERENCES trips(trip_id, network_id) ON DELETE CASCADE
);

-- Index pour accélérer les recherches par réseau et date
CREATE INDEX IF NOT EXISTS idx_cancelled_trips_network_date
ON cancelled_trips(network_id, cancellation_date);

-- Index pour accélérer les recherches par trip_id
CREATE INDEX IF NOT EXISTS idx_cancelled_trips_trip
ON cancelled_trips(trip_id, network_id);

-- RLS pour la table cancelled_trips
ALTER TABLE cancelled_trips ENABLE ROW LEVEL SECURITY;

-- Politique: Tout le monde peut voir les trajets supprimés
CREATE POLICY "Cancelled trips are viewable by everyone" 
ON cancelled_trips FOR SELECT 
USING (true);

-- Politique: Seuls les administrateurs peuvent modifier les trajets supprimés
CREATE POLICY "Only admins can insert, update or delete cancelled trips" 
ON cancelled_trips FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND modtools = 1
  )
); 