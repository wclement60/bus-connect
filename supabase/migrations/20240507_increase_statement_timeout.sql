-- Migration pour augmenter la durée d'exécution maximale des requêtes
-- Cela permet d'éviter les erreurs de timeout lors de l'importation de grandes quantités de données

-- Pour PostgreSQL
-- Augmenter le timeout de requête à 10 minutes (600000 ms) - ajustez selon vos besoins
-- Si le nom de la base de données contient des espaces, utilisez des guillemets doubles
ALTER DATABASE "Bus Connect" SET statement_timeout = 600000;

-- Option alternative: définir le timeout pour la session en cours uniquement
-- Cette option ne nécessite pas de spécifier le nom de la base de données
SET statement_timeout = 600000;

-- Pour MySQL, vous pouvez ajuster ces paramètres si nécessaire
/*
SET GLOBAL max_execution_time = 600000;
SET SESSION max_execution_time = 600000;
*/ 