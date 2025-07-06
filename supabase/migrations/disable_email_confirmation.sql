-- Désactiver la confirmation par e-mail pour les inscriptions

-- Option 1: Confirmer automatiquement tous les utilisateurs actuels non confirmés
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- Option 2: Créer un déclencheur qui confirmera automatiquement les nouveaux utilisateurs
CREATE OR REPLACE FUNCTION auth.auto_confirm_user() RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users 
  SET email_confirmed_at = now()
  WHERE id = NEW.id AND email_confirmed_at IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_confirm_user_trigger ON auth.users;
CREATE TRIGGER auto_confirm_user_trigger
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION auth.auto_confirm_user(); 