-- Fonctions supplémentaires pour le forum

-- Fonction pour incrémenter le compteur de vues d'un post
CREATE OR REPLACE FUNCTION increment_post_view_count(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.forum_posts 
  SET view_count = view_count + 1 
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les statistiques du forum
CREATE OR REPLACE FUNCTION get_forum_stats()
RETURNS TABLE(
  total_categories BIGINT,
  total_subcategories BIGINT,
  total_posts BIGINT,
  total_replies BIGINT,
  total_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.forum_categories WHERE is_active = true),
    (SELECT COUNT(*) FROM public.forum_subcategories WHERE is_active = true),
    (SELECT COUNT(*) FROM public.forum_posts),
    (SELECT COUNT(*) FROM public.forum_replies),
    (SELECT COUNT(DISTINCT author_id) FROM public.forum_posts);
END;
$$ LANGUAGE plpgsql;

-- Fonction pour nettoyer les anciens posts (optionnel - à utiliser avec précaution)
CREATE OR REPLACE FUNCTION cleanup_old_forum_data(days_old INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Supprimer les posts inactifs plus anciens que X jours
  WITH deleted AS (
    DELETE FROM public.forum_posts 
    WHERE created_at < NOW() - INTERVAL '%s days' 
    AND view_count = 0 
    AND (SELECT COUNT(*) FROM public.forum_replies WHERE post_id = forum_posts.id) = 0
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Index supplémentaires pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at ON public.forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_replies_created_at ON public.forum_replies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_view_count ON public.forum_posts(view_count DESC);

-- Vue pour les posts populaires
CREATE OR REPLACE VIEW popular_forum_posts AS
SELECT 
  p.*,
  u.first_name,
  u.last_name,
  sc.name as subcategory_name,
  c.name as category_name,
  (SELECT COUNT(*) FROM forum_replies r WHERE r.post_id = p.id) as reply_count,
  (SELECT COUNT(*) FROM forum_likes l WHERE l.post_id = p.id) as like_count
FROM forum_posts p
LEFT JOIN users u ON p.author_id = u.id
LEFT JOIN forum_subcategories sc ON p.subcategory_id = sc.id
LEFT JOIN forum_categories c ON sc.category_id = c.id
WHERE p.view_count > 10
ORDER BY p.view_count DESC, p.created_at DESC;

-- Vue pour l'activité récente du forum
CREATE OR REPLACE VIEW recent_forum_activity AS
SELECT 
  'post' as activity_type,
  p.id,
  p.title as content_preview,
  p.created_at,
  u.first_name,
  u.last_name,
  sc.name as subcategory_name,
  c.name as category_name
FROM forum_posts p
LEFT JOIN users u ON p.author_id = u.id
LEFT JOIN forum_subcategories sc ON p.subcategory_id = sc.id
LEFT JOIN forum_categories c ON sc.category_id = c.id

UNION ALL

SELECT 
  'reply' as activity_type,
  r.id,
  LEFT(r.content, 100) as content_preview,
  r.created_at,
  u.first_name,
  u.last_name,
  sc.name as subcategory_name,
  c.name as category_name
FROM forum_replies r
LEFT JOIN users u ON r.author_id = u.id
LEFT JOIN forum_posts p ON r.post_id = p.id
LEFT JOIN forum_subcategories sc ON p.subcategory_id = sc.id
LEFT JOIN forum_categories c ON sc.category_id = c.id

ORDER BY created_at DESC
LIMIT 50;

-- Commentaires sur les fonctions
COMMENT ON FUNCTION increment_post_view_count(UUID) IS 'Incrémente le compteur de vues d''un post du forum';
COMMENT ON FUNCTION get_forum_stats() IS 'Retourne les statistiques générales du forum';
COMMENT ON FUNCTION cleanup_old_forum_data(INTEGER) IS 'Nettoie les anciens posts inactifs du forum';
COMMENT ON VIEW popular_forum_posts IS 'Vue des posts populaires du forum (plus de 10 vues)';
COMMENT ON VIEW recent_forum_activity IS 'Vue de l''activité récente du forum (posts et réponses)'; 