-- Ejecuta esto en el Editor SQL de Supabase para agregar la columna del odontograma a tu tabla actual de pacientes

ALTER TABLE public.patients 
ADD COLUMN odontogram_state JSONB DEFAULT '{}'::jsonb;
