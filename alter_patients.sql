-- Ejecuta esto en el Editor SQL de Supabase para agregar las columnas a tu tabla actual de pacientes

ALTER TABLE public.patients 
ADD COLUMN affiliate_number TEXT,
ADD COLUMN address TEXT,
ADD COLUMN occupation TEXT,
ADD COLUMN medical_treatments TEXT,
ADD COLUMN systemic_diseases TEXT,
ADD COLUMN infectious_diseases TEXT,
ADD COLUMN specific_conditions TEXT,
ADD COLUMN surgeries TEXT,
ADD COLUMN habits TEXT,
ADD COLUMN main_complaint TEXT,
ADD COLUMN pain_history TEXT,
ADD COLUMN dental_trauma TEXT,
ADD COLUMN functional_difficulties TEXT,
ADD COLUMN treatment_plan TEXT;
