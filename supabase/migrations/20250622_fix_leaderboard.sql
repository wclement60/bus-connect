-- Correction des fonctions de classement et permissions

-- Corriger la fonction de classement mensuel avec SECURITY DEFINER
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Corriger la fonction de classement à vie avec SECURITY DEFINER
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour débugger les points existants
CREATE OR REPLACE FUNCTION debug_referral_points()
RETURNS TABLE (
    user_id UUID,
    total_points INTEGER,
    monthly_points INTEGER,
    current_month DATE,
    email TEXT
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

-- Fonction pour débugger l'historique des parrainages
CREATE OR REPLACE FUNCTION debug_referral_history()
RETURNS TABLE (
    referrer_id UUID,
    referred_id UUID,
    referral_code VARCHAR,
    points_awarded INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    referrer_email TEXT,
    referred_email TEXT
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