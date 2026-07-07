-- Add budget_id to bills table to link approved budgets to the billing system
ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS budget_id UUID REFERENCES public.budgets(id) ON DELETE SET NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
