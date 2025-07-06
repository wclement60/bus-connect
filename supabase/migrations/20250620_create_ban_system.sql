-- Créer la table pour stocker les bannissements
CREATE TABLE IF NOT EXISTS forum_bans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banned_by UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  message TEXT, -- Message à afficher à l'utilisateur banni
  banned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL = bannissement permanent
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX idx_forum_bans_user_id ON forum_bans(user_id);
CREATE INDEX idx_forum_bans_is_active ON forum_bans(is_active);
CREATE INDEX idx_forum_bans_expires_at ON forum_bans(expires_at);

-- Fonction pour vérifier si un utilisateur est banni
CREATE OR REPLACE FUNCTION is_user_banned(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM forum_bans 
    WHERE user_id = p_user_id 
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les détails du bannissement actif
CREATE OR REPLACE FUNCTION get_active_ban(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  reason TEXT,
  message TEXT,
  banned_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  banned_by_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.reason,
    b.message,
    b.banned_at,
    b.expires_at,
    u.first_name || ' ' || u.last_name AS banned_by_name
  FROM forum_bans b
  JOIN users u ON b.banned_by = u.id
  WHERE b.user_id = p_user_id 
  AND b.is_active = TRUE
  AND (b.expires_at IS NULL OR b.expires_at > NOW())
  ORDER BY b.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_forum_bans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_forum_bans_updated_at_trigger
BEFORE UPDATE ON forum_bans
FOR EACH ROW
EXECUTE FUNCTION update_forum_bans_updated_at();

-- Permissions
GRANT SELECT ON forum_bans TO authenticated;
GRANT INSERT, UPDATE ON forum_bans TO authenticated;

-- RLS (Row Level Security)
ALTER TABLE forum_bans ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux admins de voir tous les bannissements
CREATE POLICY "Admins can view all bans" ON forum_bans
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.modtools = 1
  ));

-- Politique pour permettre aux utilisateurs de voir leur propre bannissement
CREATE POLICY "Users can view their own ban" ON forum_bans
  FOR SELECT
  USING (user_id = auth.uid());

-- Politique pour permettre aux admins de créer des bannissements
CREATE POLICY "Admins can create bans" ON forum_bans
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.modtools = 1
  ));

-- Politique pour permettre aux admins de modifier les bannissements
CREATE POLICY "Admins can update bans" ON forum_bans
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.modtools = 1
  )); 