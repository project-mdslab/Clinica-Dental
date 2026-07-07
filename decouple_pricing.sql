-- Eliminar la clave foránea treatment_id de insurance_treatments
ALTER TABLE public.insurance_treatments DROP CONSTRAINT IF EXISTS insurance_treatments_treatment_id_fkey;

-- Eliminar la restricción UNIQUE que involucra treatment_id
ALTER TABLE public.insurance_treatments DROP CONSTRAINT IF EXISTS insurance_treatments_insurance_id_treatment_id_key;

-- Añadir la columna 'name' para independizar el nombre de la prestación
ALTER TABLE public.insurance_treatments ADD COLUMN IF NOT EXISTS name TEXT;

-- Llenar la columna 'name' con los nombres actuales (para no perder datos de prueba)
UPDATE public.insurance_treatments it
SET name = t.name
FROM public.treatments t
WHERE it.treatment_id = t.id AND it.name IS NULL;

-- Si alguna quedó vacía, poner un nombre por defecto
UPDATE public.insurance_treatments SET name = 'Prestación sin nombre' WHERE name IS NULL;

-- Hacer la columna 'name' NOT NULL
ALTER TABLE public.insurance_treatments ALTER COLUMN name SET NOT NULL;

-- Ahora sí, eliminar la columna treatment_id
ALTER TABLE public.insurance_treatments DROP COLUMN IF EXISTS treatment_id;

-- Crear una nueva restricción UNIQUE (para no tener códigos duplicados en la misma obra social)
ALTER TABLE public.insurance_treatments ADD CONSTRAINT unique_code_per_insurance UNIQUE(insurance_id, code);

-- Refrescar el caché
NOTIFY pgrst, 'reload schema';
