-- Correction des types de données dans les fonctions de classement

-- Fonction de classement mensuel avec les bons types
CREATE OR REPLACE FUNCTION get_monthly_referral_ranking(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    rank BIGINT,
    user_id UUID,
    email CHARACTER VARYING,
    first_name CHARACTER VARYING,
    last_name CHARACTER VARYING,
    monthly_points INTEGER,
    referral_code CHARACTER VARYING
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
    WHERE rp.monthly_points > 0
    ORDER BY rp.monthly_points DESC, rp.updated_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction de classement à vie avec les bons types
CREATE OR REPLACE FUNCTION get_all_time_referral_ranking(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    rank BIGINT,
    user_id UUID,
    email CHARACTER VARYING,
    first_name CHARACTER VARYING,
    last_name CHARACTER VARYING,
    total_points INTEGER,
    referral_code CHARACTER VARYING
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction de debug avec les bons types
CREATE OR REPLACE FUNCTION debug_referral_points()
RETURNS TABLE (
    user_id UUID,
    total_points INTEGER,
    monthly_points INTEGER,
    current_month DATE,
    email CHARACTER VARYING
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rp.user_id,
        rp.total_points,
        rp.monthly_points,
        rp.current_month,
        u.email
    FROM referral_points rp
    INNER JOIN auth.users u ON u.id = rp.user_id
    WHERE rp.total_points > 0 OR rp.monthly_points > 0
    ORDER BY rp.total_points DESC, rp.monthly_points DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction de debug historique avec les bons types
CREATE OR REPLACE FUNCTION debug_referral_history()
RETURNS TABLE (
    referrer_id UUID,
    referred_id UUID,
    referral_code CHARACTER VARYING,
    points_awarded INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    referrer_email CHARACTER VARYING,
    referred_email CHARACTER VARYING
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rh.referrer_id,
        rh.referred_id,
        rh.referral_code,
        rh.points_awarded,
        rh.created_at,
        u1.email as referrer_email,
        u2.email as referred_email
    FROM referral_history rh
    INNER JOIN auth.users u1 ON u1.id = rh.referrer_id
    INNER JOIN auth.users u2 ON u2.id = rh.referred_id
    ORDER BY rh.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction de test avec les bons types
CREATE OR REPLACE FUNCTION test_monthly_data()
RETURNS TABLE (
    user_id UUID,
    email CHARACTER VARYING,
    monthly_points INTEGER,
    current_month DATE,
    current_date_trunc DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rp.user_id,
        u.email,
        rp.monthly_points,
        rp.current_month,
        date_trunc('month', CURRENT_DATE)::DATE as current_date_trunc
    FROM referral_points rp
    INNER JOIN auth.users u ON u.id = rp.user_id
    WHERE rp.monthly_points > 0 OR rp.total_points > 0
    ORDER BY rp.monthly_points DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 