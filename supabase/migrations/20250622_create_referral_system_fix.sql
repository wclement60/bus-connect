-- Correction du système de parrainage
-- Cette migration corrige les problèmes du trigger automatique

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS on_user_created_referral ON users;
DROP FUNCTION IF EXISTS create_user_referral_code();

-- Fonction pour créer manuellement un code de parrainage pour un utilisateur
CREATE OR REPLACE FUNCTION create_referral_code_for_user(user_id_param UUID)
RETURNS VARCHAR AS $$
DECLARE
    new_code VARCHAR(20);
BEGIN
    -- Vérifier si l'utilisateur a déjà un code
    SELECT referral_code INTO new_code
    FROM user_referral_codes
    WHERE user_id = user_id_param;
    
    -- Si pas de code existant, en créer un
    IF new_code IS NULL THEN
        -- Générer un nouveau code
        new_code := generate_referral_code();
        
        -- Insérer le code de parrainage
        INSERT INTO user_referral_codes (user_id, referral_code)
        VALUES (user_id_param, new_code)
        ON CONFLICT (user_id) DO NOTHING;
        
        -- Insérer les points de parrainage
        INSERT INTO referral_points (user_id, total_points, monthly_points)
        VALUES (user_id_param, 0, 0)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ajouter des politiques RLS pour permettre l'insertion
CREATE POLICY "Permettre l'insertion de codes de parrainage" ON user_referral_codes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permettre l'insertion de points de parrainage" ON referral_points
    FOR INSERT WITH CHECK (true);

-- Créer des codes pour tous les utilisateurs existants qui n'en ont pas
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN 
        SELECT u.id 
        FROM users u 
        LEFT JOIN user_referral_codes urc ON u.id = urc.user_id 
        WHERE urc.user_id IS NULL
    LOOP
        PERFORM create_referral_code_for_user(user_record.id);
    END LOOP;
END $$; 