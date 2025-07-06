-- Correction du problème de current_month dans referral_points

-- Mettre à jour tous les enregistrements existants pour s'assurer que current_month est correct
UPDATE referral_points 
SET current_month = date_trunc('month', CURRENT_DATE)
WHERE current_month != date_trunc('month', CURRENT_DATE);

-- Corriger la fonction de validation pour s'assurer que current_month est toujours correct
CREATE OR REPLACE FUNCTION validate_and_apply_referral_code(
    p_referred_user_id UUID,
    p_referral_code VARCHAR
)
RETURNS JSON AS $$
DECLARE
    v_referrer_id UUID;
    v_result JSON;
    current_month_val DATE;
BEGIN
    -- Calculer le mois actuel
    current_month_val := date_trunc('month', CURRENT_DATE);
    
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
    
    -- Mettre à jour les points du parrain
    INSERT INTO referral_points (user_id, total_points, monthly_points, current_month)
    VALUES (v_referrer_id, 1, 1, current_month_val)
    ON CONFLICT (user_id) DO UPDATE
    SET 
        total_points = referral_points.total_points + 1,
        monthly_points = CASE 
            WHEN referral_points.current_month = current_month_val
            THEN referral_points.monthly_points + 1
            ELSE 1  -- Réinitialiser si nouveau mois
        END,
        current_month = current_month_val,
        updated_at = timezone('utc'::text, now());
    
    RETURN json_build_object(
        'success', true, 
        'referrer_id', v_referrer_id,
        'current_month', current_month_val,
        'debug', 'Points attribués avec succès'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour forcer la mise à jour du current_month pour tous les utilisateurs
CREATE OR REPLACE FUNCTION fix_all_current_months()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE referral_points 
    SET current_month = date_trunc('month', CURRENT_DATE),
        updated_at = timezone('utc'::text, now())
    WHERE current_month != date_trunc('month', CURRENT_DATE);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exécuter la correction
SELECT fix_all_current_months(); 