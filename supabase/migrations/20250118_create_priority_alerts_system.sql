-- Système d'alertes prioritaires urgentes
-- Créer les tables pour les alertes utilisateur et le système d'appel

-- Table pour les alertes prioritaires urgentes
CREATE TABLE IF NOT EXISTS priority_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('error', 'warning', 'violation', 'suspension')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'high' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_active BOOLEAN DEFAULT TRUE,
  can_appeal BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les appels d'alerte
CREATE TABLE IF NOT EXISTS alert_appeals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES priority_alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  additional_info TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les messages de tchat des appels
CREATE TABLE IF NOT EXISTS alert_appeal_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appeal_id UUID NOT NULL REFERENCES alert_appeals(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'file')),
  is_admin BOOLEAN DEFAULT FALSE,
  read_by_user BOOLEAN DEFAULT FALSE,
  read_by_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX idx_priority_alerts_user_id ON priority_alerts(user_id);
CREATE INDEX idx_priority_alerts_is_active ON priority_alerts(is_active);
CREATE INDEX idx_priority_alerts_severity ON priority_alerts(severity);
CREATE INDEX idx_priority_alerts_created_at ON priority_alerts(created_at);

CREATE INDEX idx_alert_appeals_alert_id ON alert_appeals(alert_id);
CREATE INDEX idx_alert_appeals_user_id ON alert_appeals(user_id);
CREATE INDEX idx_alert_appeals_status ON alert_appeals(status);

CREATE INDEX idx_alert_appeal_messages_appeal_id ON alert_appeal_messages(appeal_id);
CREATE INDEX idx_alert_appeal_messages_sender_id ON alert_appeal_messages(sender_id);

-- Fonctions utilitaires
CREATE OR REPLACE FUNCTION get_user_active_alerts(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  alert_type VARCHAR(50),
  title TEXT,
  message TEXT,
  severity VARCHAR(20),
  can_appeal BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pa.id,
    pa.alert_type,
    pa.title,
    pa.message,
    pa.severity,
    pa.can_appeal,
    pa.created_at,
    pa.expires_at
  FROM priority_alerts pa
  WHERE pa.user_id = p_user_id 
  AND pa.is_active = TRUE
  AND (pa.expires_at IS NULL OR pa.expires_at > NOW())
  ORDER BY pa.severity DESC, pa.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour créer une alerte prioritaire
CREATE OR REPLACE FUNCTION create_priority_alert(
  p_user_id UUID,
  p_alert_type VARCHAR(50),
  p_title TEXT,
  p_message TEXT,
  p_severity VARCHAR(20) DEFAULT 'high',
  p_can_appeal BOOLEAN DEFAULT TRUE,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  alert_id UUID;
  current_user_id UUID := auth.uid();
BEGIN
  INSERT INTO priority_alerts (
    user_id, alert_type, title, message, severity, 
    can_appeal, expires_at, metadata, created_by
  )
  VALUES (
    p_user_id, p_alert_type, p_title, p_message, p_severity,
    p_can_appeal, p_expires_at, p_metadata, current_user_id
  )
  RETURNING id INTO alert_id;
  
  RETURN alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_priority_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_priority_alerts_updated_at_trigger
BEFORE UPDATE ON priority_alerts
FOR EACH ROW
EXECUTE FUNCTION update_priority_alerts_updated_at();

CREATE OR REPLACE FUNCTION update_alert_appeals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_alert_appeals_updated_at_trigger
BEFORE UPDATE ON alert_appeals
FOR EACH ROW
EXECUTE FUNCTION update_alert_appeals_updated_at();

-- Permissions et RLS
ALTER TABLE priority_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_appeal_messages ENABLE ROW LEVEL SECURITY;

-- Politique pour les alertes prioritaires
-- Les utilisateurs peuvent voir leurs propres alertes
CREATE POLICY "Users can view their own alerts" ON priority_alerts
  FOR SELECT
  USING (user_id = auth.uid());

-- Les admins peuvent voir toutes les alertes
CREATE POLICY "Admins can view all alerts" ON priority_alerts
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.modtools = 1
  ));

-- Les admins peuvent créer et modifier les alertes
CREATE POLICY "Admins can manage alerts" ON priority_alerts
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.modtools = 1
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.modtools = 1
  ));

-- Politique pour les appels
-- Les utilisateurs peuvent voir leurs propres appels
CREATE POLICY "Users can view their own appeals" ON alert_appeals
  FOR SELECT
  USING (user_id = auth.uid());

-- Les utilisateurs peuvent créer des appels
CREATE POLICY "Users can create appeals" ON alert_appeals
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Les admins peuvent voir et modifier tous les appels
CREATE POLICY "Admins can manage appeals" ON alert_appeals
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.modtools = 1
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.modtools = 1
  ));

-- Politique pour les messages d'appel
-- Les utilisateurs peuvent voir les messages de leurs appels
CREATE POLICY "Users can view appeal messages" ON alert_appeal_messages
  FOR SELECT
  USING (
    appeal_id IN (
      SELECT id FROM alert_appeals WHERE user_id = auth.uid()
    )
  );

-- Les utilisateurs peuvent envoyer des messages sur leurs appels
CREATE POLICY "Users can send appeal messages" ON alert_appeal_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    appeal_id IN (
      SELECT id FROM alert_appeals WHERE user_id = auth.uid()
    )
  );

-- Les admins peuvent voir et envoyer tous les messages
CREATE POLICY "Admins can manage appeal messages" ON alert_appeal_messages
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.modtools = 1
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.modtools = 1
  ));

-- Permissions
GRANT SELECT ON priority_alerts TO authenticated;
GRANT SELECT ON alert_appeals TO authenticated;
GRANT SELECT ON alert_appeal_messages TO authenticated;
GRANT INSERT ON alert_appeals TO authenticated;
GRANT INSERT ON alert_appeal_messages TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_active_alerts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_priority_alert(UUID, VARCHAR, TEXT, TEXT, VARCHAR, BOOLEAN, TIMESTAMP WITH TIME ZONE, JSONB) TO authenticated; 