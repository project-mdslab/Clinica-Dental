-- 1. Crear tabla de Obras Sociales
CREATE TABLE insurances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Crear tabla de Prestaciones (Nomenclador)
CREATE TABLE treatments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  colegio_price NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Crear tabla de relación (Aranceles por Obra Social)
CREATE TABLE treatment_prices (
  treatment_id UUID REFERENCES treatments(id) ON DELETE CASCADE,
  insurance_id UUID REFERENCES insurances(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  PRIMARY KEY (treatment_id, insurance_id)
);

-- 4. Añadir la relación a la tabla de pacientes
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_id UUID REFERENCES insurances(id);

-- Insertar "Particular" por defecto para que siempre exista al menos una "Obra Social"
INSERT INTO insurances (name) VALUES ('Particular');
