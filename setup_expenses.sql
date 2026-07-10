-- Creación de tabla expenses para registrar gastos de insumos
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    expense_type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Seguridad a nivel de fila)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Crear política para permitir acceso a usuarios autenticados
CREATE POLICY "Allow authenticated access to expenses"
ON public.expenses
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
