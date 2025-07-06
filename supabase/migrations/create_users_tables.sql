-- Création de la table users pour stocker les informations des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création de la table user_preferences pour stocker les préférences des utilisateurs
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  favorite_network_id TEXT,
  theme TEXT DEFAULT 'light',
  notification_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Table pour les réseaux favoris
CREATE TABLE IF NOT EXISTS favorite_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  network_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, network_id)
);

-- Table pour les lignes favorites
CREATE TABLE IF NOT EXISTS favorite_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  network_id TEXT NOT NULL,
  line_id TEXT NOT NULL,
  line_name TEXT,
  line_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, network_id, line_id)
);

-- Table pour les arrêts favoris
CREATE TABLE IF NOT EXISTS favorite_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  network_id TEXT NOT NULL,
  stop_id TEXT NOT NULL,
  stop_name TEXT,
  stop_lat FLOAT,
  stop_lon FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, network_id, stop_id)
);

-- Création d'une fonction pour mettre à jour le timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Création des triggers pour mettre à jour automatiquement updated_at
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Création des politiques RLS pour la sécurité
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_stops ENABLE ROW LEVEL SECURITY;

-- Politiques pour la table users
CREATE POLICY users_select_policy ON users 
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY users_insert_policy ON users 
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY users_update_policy ON users 
  FOR UPDATE USING (auth.uid() = id);

-- Politiques pour la table user_preferences
CREATE POLICY user_preferences_select_policy ON user_preferences 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_preferences_insert_policy ON user_preferences 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_preferences_update_policy ON user_preferences 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_preferences_delete_policy ON user_preferences 
  FOR DELETE USING (auth.uid() = user_id);

-- Politiques pour la table favorite_networks
CREATE POLICY favorite_networks_select_policy ON favorite_networks 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY favorite_networks_insert_policy ON favorite_networks 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY favorite_networks_delete_policy ON favorite_networks 
  FOR DELETE USING (auth.uid() = user_id);

-- Politiques pour la table favorite_lines
CREATE POLICY favorite_lines_select_policy ON favorite_lines 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY favorite_lines_insert_policy ON favorite_lines 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY favorite_lines_delete_policy ON favorite_lines 
  FOR DELETE USING (auth.uid() = user_id);

-- Politiques pour la table favorite_stops
CREATE POLICY favorite_stops_select_policy ON favorite_stops 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY favorite_stops_insert_policy ON favorite_stops 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY favorite_stops_delete_policy ON favorite_stops 
  FOR DELETE USING (auth.uid() = user_id);

-- Fonction pour créer automatiquement un profil utilisateur après l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  
  INSERT INTO public.user_preferences (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour exécuter la fonction après l'inscription d'un nouvel utilisateur
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 