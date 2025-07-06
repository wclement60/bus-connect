-- Ajout des nouveaux champs à la table users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other')),
ADD COLUMN IF NOT EXISTS departement TEXT CHECK (departement ~ '^(0[1-9]|[1-9][0-9]|2[AB]|97[1-4]|976)$');

-- Mise à jour de la fonction handle_new_user pour inclure les nouveaux champs
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, birth_date, gender, departement)
  VALUES (new.id, new.email, null, null, null);
  
  INSERT INTO public.user_preferences (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires sur les colonnes
COMMENT ON COLUMN users.birth_date IS 'Date de naissance de l''utilisateur';
COMMENT ON COLUMN users.gender IS 'Genre de l''utilisateur (male, female, other)';
COMMENT ON COLUMN users.departement IS 'Code du département de l''utilisateur (01-95, 2A, 2B, 971-974, 976)'; 