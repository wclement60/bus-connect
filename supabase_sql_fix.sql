-- Créer une fonction pour accéder à tous les utilisateurs
-- Cette fonction sera utilisée par l'administrateur

-- IMPORTANT: Exécutez ce script SQL dans l'interface SQL Editor de Supabase

-- 1. Créer une nouvelle fonction qui ignore les politiques RLS
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS SETOF public.users
LANGUAGE sql
SECURITY DEFINER -- Cette fonction s'exécute avec les permissions du propriétaire
AS $$
  SELECT * FROM public.users ORDER BY created_at DESC;
$$;

-- 2. Solution 1: Désactiver la politique actuellement défective
DROP POLICY IF EXISTS "Allow admins to see all users" ON public.users;

-- 3. Solution 2: Créer une table séparée pour les rôles administrateurs
CREATE TABLE IF NOT EXISTS admin_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insérer les administrateurs actuels
INSERT INTO admin_roles (user_id)
SELECT id FROM public.users WHERE modtools = 1
ON CONFLICT (user_id) DO NOTHING;

-- Créer une nouvelle politique qui ne cause pas de récursion
CREATE POLICY "Allow admins to see all users" 
ON public.users
FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
);

-- 4. Solution 3: Utiliser une approche par fonction pour éviter la récursion
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin boolean;
BEGIN
  SELECT (modtools = 1) INTO is_admin
  FROM public.users
  WHERE id = auth.uid();
  
  RETURN COALESCE(is_admin, false);
END;
$$;

-- Politique alternative utilisant la fonction
CREATE POLICY "Allow admin access based on function" 
ON public.users
FOR ALL 
USING (
  is_admin() OR (id = auth.uid())
);

-- 5. Pour tester, on peut ajouter cette politique simplifiée qui fonctionne toujours
-- Mais attention: cela donne accès à tout le monde ayant un compte
CREATE POLICY "Allow all authenticated users to see all users" 
ON public.users
FOR SELECT 
USING (
  auth.role() = 'authenticated'
);

-- 6. En dernier recours, si rien ne fonctionne, vous pouvez désactiver temporairement RLS
-- ATTENTION: N'exécutez cette commande que temporairement en développement
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY; 