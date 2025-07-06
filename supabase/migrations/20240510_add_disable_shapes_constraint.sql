-- Migration pour ajouter une fonction permettant de désactiver temporairement les contraintes sur la table shapes
-- Cette fonction est utilisée lors de la suppression des données pour contourner les erreurs de contrainte

-- Fonction pour désactiver temporairement les contraintes de clé étrangère sur la table shapes
CREATE OR REPLACE FUNCTION public.disable_shapes_constraint()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Désactiver temporairement les contraintes de clé étrangère uniquement pour la table shapes
  ALTER TABLE public.shapes DROP CONSTRAINT IF EXISTS shapes_network_id_fkey;
  
  -- Log l'opération
  RAISE NOTICE 'Constraint shapes_network_id_fkey temporarily disabled';
END;
$$;

-- Fonction pour recréer la contrainte (à utiliser après les opérations de maintenance)
CREATE OR REPLACE FUNCTION public.enable_shapes_constraint()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Recréer la contrainte de clé étrangère pour la table shapes
  ALTER TABLE public.shapes 
    ADD CONSTRAINT shapes_network_id_fkey
    FOREIGN KEY (network_id)
    REFERENCES public.networks(network_id);
  
  -- Log l'opération
  RAISE NOTICE 'Constraint shapes_network_id_fkey re-enabled';
END;
$$;

-- Ajouter des commentaires pour les fonctions
COMMENT ON FUNCTION public.disable_shapes_constraint IS 'Désactive temporairement la contrainte de clé étrangère sur la table shapes pour permettre des opérations de maintenance';
COMMENT ON FUNCTION public.enable_shapes_constraint IS 'Réactive la contrainte de clé étrangère sur la table shapes après des opérations de maintenance';

-- Ajouter les permissions pour les fonctions
GRANT EXECUTE ON FUNCTION public.disable_shapes_constraint TO authenticated;
GRANT EXECUTE ON FUNCTION public.disable_shapes_constraint TO service_role;
GRANT EXECUTE ON FUNCTION public.enable_shapes_constraint TO authenticated;
GRANT EXECUTE ON FUNCTION public.enable_shapes_constraint TO service_role; 