-- Création du système de parrainage
-- Cette migration crée les tables nécessaires pour gérer les codes de parrainage et les points

-- Table pour stocker les codes de parrainage des utilisateurs
CREATE TABLE user_referral_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id) -- Un seul code par utilisateur
);

-- Table pour stocker les points de parrainage
CREATE TABLE referral_points (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_points INTEGER DEFAULT 0 NOT NULL,
    monthly_points INTEGER DEFAULT 0 NOT NULL,
    current_month DATE DEFAULT date_trunc('month', CURRENT_DATE) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- Table pour l'historique des parrainages
CREATE TABLE referral_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) NOT NULL,
    points_awarded INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(referred_id) -- Un utilisateur ne peut être parrainé qu'une seule fois
);

-- Index pour améliorer les performances
CREATE INDEX idx_user_referral_codes_user_id ON user_referral_codes(user_id);
CREATE INDEX idx_user_referral_codes_referral_code ON user_referral_codes(referral_code);
CREATE INDEX idx_referral_points_user_id ON referral_points(user_id);
CREATE INDEX idx_referral_points_monthly ON referral_points(current_month, monthly_points DESC);
CREATE INDEX idx_referral_points_total ON referral_points(total_points DESC);
CREATE INDEX idx_referral_history_referrer ON referral_history(referrer_id);
CREATE INDEX idx_referral_history_referred ON referral_history(referred_id);

-- Fonction pour générer un code de parrainage unique
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS VARCHAR AS $$
DECLARE
    new_code VARCHAR(20);
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Générer un code au format BUSCO-XXXX (lettres et chiffres)
        new_code := 'BUSCO-' || upper(
            substr(md5(random()::text), 1, 2) || 
            floor(random() * 1000)::text || 
            substr(md5(random()::text), 1, 2)
        );
        
        -- Vérifier si le code existe déjà
        SELECT EXISTS(SELECT 1 FROM user_referral_codes WHERE referral_code = new_code) INTO code_exists;
        
        -- Si le code n'existe pas, on peut l'utiliser
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour créer automatiquement un code de parrainage pour chaque nouvel utilisateur
CREATE OR REPLACE FUNCTION create_user_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Créer un code de parrainage pour le nouvel utilisateur
    INSERT INTO user_referral_codes (user_id, referral_code)
    VALUES (NEW.id, generate_referral_code());
    
    -- Créer une entrée dans referral_points avec 0 points
    INSERT INTO referral_points (user_id, total_points, monthly_points)
    VALUES (NEW.id, 0, 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger sur la table users (pas auth.users directement)
CREATE TRIGGER on_user_created_referral
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_user_referral_code();

-- Fonction pour valider un code de parrainage et attribuer les points
CREATE OR REPLACE FUNCTION validate_and_apply_referral_code(
    p_referred_user_id UUID,
    p_referral_code VARCHAR
)
RETURNS JSON AS $$
DECLARE
    v_referrer_id UUID;
    v_result JSON;
BEGIN
    -- Vérifier si l'utilisateur a déjà été parrainé
    IF EXISTS (SELECT 1 FROM referral_history WHERE referred_id = p_referred_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'Cet utilisateur a déjà été parrainé');
    END IF;
    
    -- Trouver le propriétaire du code de parrainage
    SELECT user_id INTO v_referrer_id
    FROM user_referral_codes
    WHERE referral_code = p_referral_code;
    
    -- Si le code n'existe pas
    IF v_referrer_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Ce code n''est pas valide');
    END IF;
    
    -- Empêcher l'auto-parrainage
    IF v_referrer_id = p_referred_user_id THEN
        RETURN json_build_object('success', false, 'error', 'Vous ne pouvez pas utiliser votre propre code');
    END IF;
    
    -- Tout est OK, enregistrer le parrainage
    INSERT INTO referral_history (referrer_id, referred_id, referral_code)
    VALUES (v_referrer_id, p_referred_user_id, p_referral_code);
    
    -- Mettre à jour les points du parrain (referrer)
    INSERT INTO referral_points (user_id, total_points, monthly_points)
    VALUES (v_referrer_id, 1, 1)
    ON CONFLICT (user_id) DO UPDATE
    SET 
        total_points = referral_points.total_points + 1,
        monthly_points = CASE 
            WHEN referral_points.current_month = date_trunc('month', CURRENT_DATE) 
            THEN referral_points.monthly_points + 1
            ELSE 1
        END,
        current_month = date_trunc('month', CURRENT_DATE),
        updated_at = timezone('utc'::text, now());
    
    -- Donner 1 point au nouvel utilisateur (referred) aussi !
    INSERT INTO referral_points (user_id, total_points, monthly_points)
    VALUES (p_referred_user_id, 1, 1)
    ON CONFLICT (user_id) DO UPDATE
    SET 
        total_points = referral_points.total_points + 1,
        monthly_points = CASE 
            WHEN referral_points.current_month = date_trunc('month', CURRENT_DATE) 
            THEN referral_points.monthly_points + 1
            ELSE 1
        END,
        current_month = date_trunc('month', CURRENT_DATE),
        updated_at = timezone('utc'::text, now());
    
    RETURN json_build_object(
        'success', true, 
        'referrer_id', v_referrer_id,
        'message', 'Parrainage appliqué avec succès ! Vous avez tous les deux gagné 1 point.'
    );
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir le classement mensuel
CREATE OR REPLACE FUNCTION get_monthly_referral_ranking(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    rank BIGINT,
    user_id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    monthly_points INTEGER,
    referral_code VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY rp.monthly_points DESC, rp.updated_at ASC) as rank,
        u.id as user_id,
        u.email,
        p.first_name,
        p.last_name,
        rp.monthly_points,
        rc.referral_code
    FROM referral_points rp
    INNER JOIN auth.users u ON u.id = rp.user_id
    LEFT JOIN users p ON p.id = rp.user_id
    LEFT JOIN user_referral_codes rc ON rc.user_id = rp.user_id
    WHERE rp.current_month = date_trunc('month', CURRENT_DATE)
    AND rp.monthly_points > 0
    ORDER BY rp.monthly_points DESC, rp.updated_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir le classement à vie
CREATE OR REPLACE FUNCTION get_all_time_referral_ranking(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    rank BIGINT,
    user_id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    total_points INTEGER,
    referral_code VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY rp.total_points DESC, rp.created_at ASC) as rank,
        u.id as user_id,
        u.email,
        p.first_name,
        p.last_name,
        rp.total_points,
        rc.referral_code
    FROM referral_points rp
    INNER JOIN auth.users u ON u.id = rp.user_id
    LEFT JOIN users p ON p.id = rp.user_id
    LEFT JOIN user_referral_codes rc ON rc.user_id = rp.user_id
    WHERE rp.total_points > 0
    ORDER BY rp.total_points DESC, rp.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- RLS (Row Level Security) policies
ALTER TABLE user_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_history ENABLE ROW LEVEL SECURITY;

-- Politique pour user_referral_codes
CREATE POLICY "Les utilisateurs peuvent voir leur propre code" ON user_referral_codes
    FOR SELECT USING (auth.uid() = user_id);

-- Politique pour referral_points
CREATE POLICY "Les utilisateurs peuvent voir tous les points (pour classement)" ON referral_points
    FOR SELECT USING (true);

-- Politique pour referral_history
CREATE POLICY "Les utilisateurs peuvent voir leur historique de parrainage" ON referral_history
    FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Créer des codes de parrainage pour les utilisateurs existants
INSERT INTO user_referral_codes (user_id, referral_code)
SELECT id, generate_referral_code()
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM user_referral_codes WHERE user_id = users.id
);

-- Créer des entrées de points pour les utilisateurs existants
INSERT INTO referral_points (user_id, total_points, monthly_points)
SELECT id, 0, 0
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM referral_points WHERE user_id = users.id
); 