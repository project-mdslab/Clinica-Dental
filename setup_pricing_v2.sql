-- Drop old tables if they exist to start fresh
DROP TABLE IF EXISTS treatment_prices CASCADE;
DROP TABLE IF EXISTS insurance_treatments CASCADE;
DROP TABLE IF EXISTS treatments CASCADE;
DROP TABLE IF EXISTS insurances CASCADE;

-- 1. Obras Sociales
CREATE TABLE insurances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  has_copay BOOLEAN DEFAULT false,
  modality TEXT DEFAULT 'DESCONOCIDO',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Nomenclador Colegio de Odontólogos
CREATE TABLE treatments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  colegio_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Prestaciones de Obras Sociales (Independientes del Colegio)
CREATE TABLE insurance_treatments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  insurance_id UUID REFERENCES insurances(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  coverage_price NUMERIC NOT NULL DEFAULT 0,
  copay_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(insurance_id, code, name)
);

-- Permisos (Para desarrollo local, habilitamos todo)
ALTER TABLE insurances ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON insurances FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON insurances FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON insurances FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON insurances FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON treatments FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON treatments FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON treatments FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON treatments FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON insurance_treatments FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON insurance_treatments FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON insurance_treatments FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON insurance_treatments FOR DELETE USING (true);
