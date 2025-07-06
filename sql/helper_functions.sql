-- Fonction pour vérifier si une table existe
CREATE OR REPLACE FUNCTION public.table_exists(table_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = table_name
  );
END;
$$ LANGUAGE plpgsql;

-- Fonction pour désactiver temporairement les contraintes de clé étrangère
CREATE OR REPLACE FUNCTION public.disable_triggers()
RETURNS VOID AS $$
BEGIN
  SET session_replication_role = 'replica';
END;
$$ LANGUAGE plpgsql;

-- Fonction pour réactiver les contraintes de clé étrangère
CREATE OR REPLACE FUNCTION public.enable_triggers()
RETURNS VOID AS $$
BEGIN
  SET session_replication_role = 'origin';
END;
$$ LANGUAGE plpgsql;

-- Fonction pour augmenter les paramètres de performance pour les opérations volumineuses
CREATE OR REPLACE FUNCTION public.optimize_for_bulk_operations()
RETURNS VOID AS $$
BEGIN
  SET work_mem TO 524288;          -- 512MB en kB
  SET maintenance_work_mem TO 2097152;  -- 2GB en kB
  SET statement_timeout TO 3600000;     -- 1 heure en ms
END;
$$ LANGUAGE plpgsql;

-- Fonction pour réinitialiser les paramètres de performance
CREATE OR REPLACE FUNCTION public.reset_performance_parameters()
RETURNS VOID AS $$
BEGIN
  RESET work_mem;
  RESET maintenance_work_mem;
  RESET statement_timeout;
END;
$$ LANGUAGE plpgsql; 