-- Supprimer l'ancienne fonction si elle existe
DROP FUNCTION IF EXISTS get_today_birthdays();

-- Fonction pour récupérer les utilisateurs dont c'est l'anniversaire aujourd'hui
CREATE OR REPLACE FUNCTION get_today_birthdays()
RETURNS TABLE (
    id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    birth_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.birth_date
    FROM users u
    WHERE u.birth_date IS NOT NULL
    AND EXTRACT(MONTH FROM u.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM u.birth_date) = EXTRACT(DAY FROM CURRENT_DATE)
    ORDER BY u.first_name, u.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accorder les permissions pour exécuter cette fonction
GRANT EXECUTE ON FUNCTION get_today_birthdays() TO authenticated;
GRANT EXECUTE ON FUNCTION get_today_birthdays() TO anon; 