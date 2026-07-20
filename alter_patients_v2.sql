ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS secondary_insurance_id UUID REFERENCES public.insurances(id);
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS condition TEXT;
