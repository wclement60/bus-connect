-- Vue pour obtenir le dernier post de chaque sous-catégorie
CREATE OR REPLACE VIEW forum_subcategories_with_latest_post AS
SELECT 
  fs.*,
  lp.latest_post_id,
  lp.latest_post_title,
  lp.latest_post_created_at,
  lp.latest_post_author_id,
  lp.latest_post_author_first_name,
  lp.latest_post_author_last_name,
  lp.latest_post_author_avatar_url,
  lp.latest_post_author_modtools
FROM forum_subcategories fs
LEFT JOIN LATERAL (
  SELECT 
    fp.id AS latest_post_id,
    fp.title AS latest_post_title,
    fp.created_at AS latest_post_created_at,
    fp.author_id AS latest_post_author_id,
    u.first_name AS latest_post_author_first_name,
    u.last_name AS latest_post_author_last_name,
    u.avatar_url AS latest_post_author_avatar_url,
    u.modtools AS latest_post_author_modtools
  FROM forum_posts fp
  LEFT JOIN users u ON fp.author_id = u.id
  WHERE fp.subcategory_id = fs.id
  ORDER BY fp.created_at DESC
  LIMIT 1
) lp ON true;

-- Vue pour obtenir la dernière réponse de chaque post
CREATE OR REPLACE VIEW forum_posts_with_latest_reply AS
SELECT 
  fp.*,
  lr.latest_reply_id,
  lr.latest_reply_created_at,
  lr.latest_reply_author_id,
  lr.latest_reply_author_first_name,
  lr.latest_reply_author_last_name,
  lr.latest_reply_author_avatar_url,
  lr.latest_reply_author_modtools
FROM forum_posts fp
LEFT JOIN LATERAL (
  SELECT 
    fr.id AS latest_reply_id,
    fr.created_at AS latest_reply_created_at,
    fr.author_id AS latest_reply_author_id,
    u.first_name AS latest_reply_author_first_name,
    u.last_name AS latest_reply_author_last_name,
    u.avatar_url AS latest_reply_author_avatar_url,
    u.modtools AS latest_reply_author_modtools
  FROM forum_replies fr
  LEFT JOIN users u ON fr.author_id = u.id
  WHERE fr.post_id = fp.id
  ORDER BY fr.created_at DESC
  LIMIT 1
) lr ON true;

-- Donner les permissions
GRANT SELECT ON forum_subcategories_with_latest_post TO authenticated;
GRANT SELECT ON forum_posts_with_latest_reply TO authenticated;
GRANT SELECT ON forum_subcategories_with_latest_post TO anon;
GRANT SELECT ON forum_posts_with_latest_reply TO anon; 