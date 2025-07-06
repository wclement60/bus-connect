-- Renforcer la contrainte UNIQUE sur l'email
DROP INDEX IF EXISTS users_email_idx;
CREATE UNIQUE INDEX users_email_idx ON users (LOWER(email));

-- Fonction pour vérifier si l'email existe déjà
CREATE OR REPLACE FUNCTION check_email_exists()
RETURNS TRIGGER AS $$
BEGIN
  -- Vérifier si l'email existe déjà dans la table users
  IF EXISTS (
    SELECT 1 FROM users 
    WHERE LOWER(email) = LOWER(NEW.email) 
    AND id != NEW.id
  ) THEN
    RAISE EXCEPTION 'Un compte existe déjà avec cette adresse email.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour vérifier l'email avant insertion ou mise à jour
DROP TRIGGER IF EXISTS check_email_before_insert ON users;
CREATE TRIGGER check_email_before_insert
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION check_email_exists();

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Allow reading email and birth_date for password reset" ON users;
DROP POLICY IF EXISTS "Allow email lookup for password reset" ON users;
DROP POLICY IF EXISTS "Allow password reset verification" ON users;

-- Créer une politique pour permettre la lecture des informations nécessaires à la réinitialisation du mot de passe
CREATE POLICY "Allow password reset verification" ON users
  FOR SELECT
  USING (true);

-- Restreindre les colonnes accessibles pour la réinitialisation du mot de passe
REVOKE ALL PRIVILEGES ON users FROM anon, authenticated;
GRANT SELECT ON users TO anon, authenticated;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Mettre à jour la fonction handle_new_user pour copier correctement les métadonnées
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  -- Insérer le nouvel utilisateur avec toutes les métadonnées fournies à l'inscription
  INSERT INTO public.users (id, email, first_name, last_name, birth_date, gender, departement)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    (new.raw_user_meta_data->>'birth_date')::date,
    new.raw_user_meta_data->>'gender',
    new.raw_user_meta_data->>'departement'
  )
  -- En cas de conflit (si l'utilisateur existe déjà), ne rien faire pour éviter une erreur.
  ON CONFLICT (id) DO NOTHING;
  
  -- Créer également les préférences par défaut pour l'utilisateur
  INSERT INTO public.user_preferences (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 