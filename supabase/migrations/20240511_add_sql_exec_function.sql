-- Migration pour ajouter une fonction permettant d'exécuter des requêtes SQL directement
-- Cette fonction est utilisée pour contourner les problèmes de schéma durant la suppression de données

-- Fonction pour exécuter des requêtes SQL simples (DELETE)
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Exécuter la requête SQL fournie
  EXECUTE sql_query;
  
  -- Log l'opération
  RAISE NOTICE 'Executed SQL: %', sql_query;
END;
$$;

-- Ajouter des commentaires pour la fonction
COMMENT ON FUNCTION public.exec_sql IS 'Exécute une requête SQL simple, utilisée pour contourner les problèmes de schéma';

-- Ajouter les permissions pour la fonction
GRANT EXECUTE ON FUNCTION public.exec_sql TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql TO service_role; 