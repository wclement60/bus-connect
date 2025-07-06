-- Version simplifiée des fonctions de classement pour débugger

-- Fonction de classement mensuel simplifiée
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
    WHERE rp.monthly_points > 0
    -- Retirer temporairement le filtre de mois pour voir si ça marche
    ORDER BY rp.monthly_points DESC, rp.updated_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction simple pour tester les données
CREATE OR REPLACE FUNCTION test_monthly_data()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
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