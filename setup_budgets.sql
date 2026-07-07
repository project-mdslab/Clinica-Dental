-- 1. Tabla de Pagos de Presupuestos
CREATE TABLE IF NOT EXISTS public.budget_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method TEXT,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en la nueva tabla
ALTER TABLE public.budget_payments ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para budget_payments (Mismo acceso que budgets)
CREATE POLICY "Role based SELECT on budget_payments" 
ON public.budget_payments FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.budgets 
    WHERE public.budgets.id = public.budget_payments.budget_id 
    AND (
      (public.get_my_role() = 'superuser')
      OR 
      (public.budgets.user_id = auth.uid() AND public.get_my_role() = 'professional')
    )
  )
);

CREATE POLICY "Role based INSERT on budget_payments" 
ON public.budget_payments FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.budgets 
    WHERE public.budgets.id = budget_id 
    AND (
      (public.get_my_role() = 'superuser') 
      OR 
      (public.budgets.user_id = auth.uid() AND public.get_my_role() = 'professional')
    )
  )
);

CREATE POLICY "Role based UPDATE on budget_payments" 
ON public.budget_payments FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.budgets 
    WHERE public.budgets.id = public.budget_payments.budget_id 
    AND (
      (public.get_my_role() = 'superuser') 
      OR 
      (public.budgets.user_id = auth.uid() AND public.get_my_role() = 'professional')
    )
  )
);

CREATE POLICY "Role based DELETE on budget_payments" 
ON public.budget_payments FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.budgets 
    WHERE public.budgets.id = public.budget_payments.budget_id 
    AND (
      (public.get_my_role() = 'superuser') 
      OR 
      (public.budgets.user_id = auth.uid() AND public.get_my_role() = 'professional')
    )
  )
);

-- Recargar caché de esquema (vital para evitar errores en la UI)
NOTIFY pgrst, 'reload schema';
