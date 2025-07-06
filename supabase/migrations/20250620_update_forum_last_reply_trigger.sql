-- Créer un trigger pour mettre à jour automatiquement last_reply_at quand une réponse est créée
CREATE OR REPLACE FUNCTION update_post_last_reply_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE forum_posts
  SET last_reply_at = NEW.created_at
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS update_post_last_reply_at_trigger ON forum_replies;
CREATE TRIGGER update_post_last_reply_at_trigger
AFTER INSERT ON forum_replies
FOR EACH ROW
EXECUTE FUNCTION update_post_last_reply_at();

-- Mettre à jour les données existantes
-- Pour chaque post, trouver la date de la dernière réponse et mettre à jour last_reply_at
UPDATE forum_posts
SET last_reply_at = (
  SELECT MAX(created_at)
  FROM forum_replies
  WHERE forum_replies.post_id = forum_posts.id
)
WHERE EXISTS (
  SELECT 1
  FROM forum_replies
  WHERE forum_replies.post_id = forum_posts.id
);

-- Pour les posts sans réponses, mettre last_reply_at = created_at
UPDATE forum_posts
SET last_reply_at = created_at
WHERE last_reply_at IS NULL; 