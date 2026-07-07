-- Añadir la columna de relación a la tabla de facturas
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS clinical_note_id UUID REFERENCES public.clinical_notes(id) ON DELETE CASCADE;

-- Refrescar el caché
NOTIFY pgrst, 'reload schema';
