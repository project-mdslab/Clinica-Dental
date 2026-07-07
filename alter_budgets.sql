ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pendiente',
ADD COLUMN IF NOT EXISTS observations TEXT;

NOTIFY pgrst, 'reload schema';
