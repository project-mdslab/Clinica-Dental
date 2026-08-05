CREATE TABLE IF NOT EXISTS public.document_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title varchar NOT NULL,
  type varchar NOT NULL, -- 'certificate', 'consent', 'prescription'
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.patient_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.document_templates(id) ON DELETE SET NULL,
  professional_id uuid, -- Who generated the document
  title varchar NOT NULL,
  type varchar NOT NULL,
  content text NOT NULL,
  signature_url text, -- Base64 or URL for the digital signature if signed
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

-- Políticas para document_templates
DROP POLICY IF EXISTS "Enable read access for all users" ON public.document_templates;
CREATE POLICY "Enable read access for all users" ON public.document_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON public.document_templates;
CREATE POLICY "Enable insert access for all users" ON public.document_templates FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON public.document_templates;
CREATE POLICY "Enable update access for all users" ON public.document_templates FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete access for all users" ON public.document_templates;
CREATE POLICY "Enable delete access for all users" ON public.document_templates FOR DELETE USING (true);

-- Políticas para patient_documents
DROP POLICY IF EXISTS "Enable read access for all users" ON public.patient_documents;
CREATE POLICY "Enable read access for all users" ON public.patient_documents FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON public.patient_documents;
CREATE POLICY "Enable insert access for all users" ON public.patient_documents FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON public.patient_documents;
CREATE POLICY "Enable update access for all users" ON public.patient_documents FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete access for all users" ON public.patient_documents;
CREATE POLICY "Enable delete access for all users" ON public.patient_documents FOR DELETE USING (true);
