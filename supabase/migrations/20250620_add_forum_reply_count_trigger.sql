-- Créer un trigger pour décrémenter le compteur de réponses lors de la suppression
CREATE OR REPLACE FUNCTION decrement_post_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Ne rien faire, le compteur est calculé dynamiquement avec COUNT
  -- Cette fonction est là pour la cohérence mais n'est pas nécessaire
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Note: Avec la structure actuelle utilisant forum_replies(count),
-- le décompte est automatiquement mis à jour lors de la suppression
-- Ce fichier est créé pour documentation mais n'est pas nécessaire 