-- Ajouter une colonne modtools à la table users pour les droits d'administration
ALTER TABLE public.users ADD COLUMN modtools SMALLINT DEFAULT 0 NOT NULL;

-- Créer un index pour accélérer les requêtes basées sur modtools
CREATE INDEX idx_users_modtools ON public.users(modtools);

-- Commentaire pour documenter la colonne
COMMENT ON COLUMN public.users.modtools IS 'Droits d''administration: 0 = utilisateur normal, 1 = administrateur';

-- Pour définir un utilisateur comme administrateur, utilisez la commande:
-- UPDATE public.users SET modtools = 1 WHERE id = 'ID_UTILISATEUR'; 