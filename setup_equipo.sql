-- Eliminar la función anterior porque vamos a cambiar las columnas que devuelve
DROP FUNCTION IF EXISTS public.get_professionals();

-- Crear la nueva función get_professionals incluyendo el color
CREATE OR REPLACE FUNCTION public.get_professionals()
RETURNS TABLE (
    id UUID,
    name TEXT,
    email TEXT,
    color TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id, 
        COALESCE(
            (u.raw_user_meta_data->>'first_name') || ' ' || COALESCE(u.raw_user_meta_data->>'last_name', ''), 
            ''
        ) AS name,
        u.email::TEXT,
        COALESCE(u.raw_user_meta_data->>'color', 'bg-primary') AS color
    FROM auth.users u
    WHERE 
        u.raw_user_meta_data->>'role' = 'professional' 
        OR u.raw_user_meta_data->>'role' = 'superuser'
    ORDER BY name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
