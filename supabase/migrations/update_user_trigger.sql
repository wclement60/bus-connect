-- Mise à jour de la fonction handle_new_user pour inclure les données de profil
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name)
  VALUES (
    new.id, 
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  );
  
  INSERT INTO public.user_preferences (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mettre à jour manuellement les utilisateurs existants
UPDATE public.users
SET 
  first_name = auth.users.raw_user_meta_data->>'first_name',
  last_name = auth.users.raw_user_meta_data->>'last_name'
FROM auth.users
WHERE public.users.id = auth.users.id
  AND (public.users.first_name IS NULL OR public.users.last_name IS NULL); 