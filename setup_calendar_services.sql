CREATE TABLE IF NOT EXISTS public.calendar_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.calendar_services ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view, insert, update and delete
CREATE POLICY "Allow authenticated users to select services" 
  ON public.calendar_services FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated users to insert services" 
  ON public.calendar_services FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update services" 
  ON public.calendar_services FOR UPDATE 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated users to delete services" 
  ON public.calendar_services FOR DELETE 
  TO authenticated 
  USING (true);

-- Insert initial default services if table is empty
INSERT INTO public.calendar_services (name, color)
SELECT * FROM (
  VALUES 
    ('Consulta', 'bg-primary'),
    ('Cirugía', 'bg-[#EF4444]'),
    ('Endodoncia', 'bg-[#F59E0B]'),
    ('Limpieza', 'bg-[#10B981]')
) AS default_services(name, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.calendar_services LIMIT 1
);
