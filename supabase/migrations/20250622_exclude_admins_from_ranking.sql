-- Exclure les administrateurs (modtools = 1) du classement de parrainage

-- Supprimer les anciennes fonctions
DROP FUNCTION IF EXISTS get_monthly_referral_ranking(integer);
DROP FUNCTION IF EXISTS get_all_time_referral_ranking(integer);

-- Fonction de classement mensuel sans les administrateurs
CREATE OR REPLACE FUNCTION get_monthly_referral_ranking(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    rank BIGINT,
    user_id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    monthly_points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY rp.monthly_points DESC, rp.updated_at ASC) as rank,
        u.id as user_id,
        u.email::TEXT,
        p.first_name::TEXT,
        p.last_name::TEXT,
        p.avatar_url::TEXT,
        rp.monthly_points
    FROM referral_points rp
    INNER JOIN auth.users u ON u.id = rp.user_id
    LEFT JOIN users p ON p.id = rp.user_id
    WHERE rp.monthly_points > 0
    AND (p.modtools IS NULL OR p.modtools != 1)  -- Exclure les administrateurs
    ORDER BY rp.monthly_points DESC, rp.updated_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction de classement à vie sans les administrateurs
CREATE OR REPLACE FUNCTION get_all_time_referral_ranking(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    rank BIGINT,
    user_id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    total_points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY rp.total_points DESC, rp.created_at ASC) as rank,
        u.id as user_id,
        u.email::TEXT,
        p.first_name::TEXT,
        p.last_name::TEXT,
        p.avatar_url::TEXT,
        rp.total_points
    FROM referral_points rp
    INNER JOIN auth.users u ON u.id = rp.user_id
    LEFT JOIN users p ON p.id = rp.user_id
    WHERE rp.total_points > 0
    AND (p.modtools IS NULL OR p.modtools != 1)  -- Exclure les administrateurs
    ORDER BY rp.total_points DESC, rp.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 