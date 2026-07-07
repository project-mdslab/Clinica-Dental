-- 1. Crear el puente entre pacientes y la nueva lista estricta de obras sociales
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS insurance_id UUID REFERENCES public.insurances(id) ON DELETE SET NULL;

-- 2. Refrescar la memoria de Supabase para que reconozca el cambio al instante
NOTIFY pgrst, 'reload schema';
