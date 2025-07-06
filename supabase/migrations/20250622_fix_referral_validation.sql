-- Correction des permissions pour la validation des codes de parrainage

-- Modifier la fonction de validation pour être exécutée avec des privilèges élevés
CREATE OR REPLACE FUNCTION validate_and_apply_referral_code(
    p_referred_user_id UUID,
    p_referral_code VARCHAR
)
RETURNS JSON AS $$
DECLARE
    v_referrer_id UUID;
    v_result JSON;
BEGIN
    -- Debug: Vérifier si l'utilisateur a déjà été parrainé
    IF EXISTS (SELECT 1 FROM referral_history WHERE referred_id = p_referred_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'Cet utilisateur a déjà été parrainé');
    END IF;
    
    -- Debug: Trouver le propriétaire du code de parrainage (sans RLS)
    SELECT user_id INTO v_referrer_id
    FROM user_referral_codes
    WHERE referral_code = p_referral_code;
    
    -- Debug: Si le code n'existe pas
    IF v_referrer_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Ce code n''est pas valide', 'debug_code', p_referral_code);
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permettre à tous les utilisateurs authentifiés de voir les codes de parrainage pour la validation
DROP POLICY IF EXISTS "Les utilisateurs peuvent voir leur propre code" ON user_referral_codes;

CREATE POLICY "Lire tous les codes pour validation" ON user_referral_codes
    FOR SELECT USING (true);

-- Permettre l'insertion dans l'historique de parrainage
CREATE POLICY "Insertion historique parrainage" ON referral_history
    FOR INSERT WITH CHECK (true);

-- Permettre la mise à jour des points de parrainage
CREATE POLICY "Mise à jour points parrainage" ON referral_points
    FOR UPDATE USING (true);

-- Fonction pour débugger les codes existants (à supprimer après résolution)
CREATE OR REPLACE FUNCTION debug_referral_codes()
RETURNS TABLE (
    user_id UUID,
    referral_code VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT urc.user_id, urc.referral_code, urc.created_at
    FROM user_referral_codes urc
    ORDER BY urc.created_at DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 