-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase
-- Esto creará los usuarios necesarios (saltando los límites de rate) y agregará turnos de prueba.

-- 1. Deshabilitar RLS temporalmente
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;

-- 2. Asignar roles a los usuarios creados previamente (admin y martina)
INSERT INTO public.user_roles (user_id, role)
VALUES 
    ('e09b1032-3ab8-43b0-8ed9-f9931395e4dc', 'superuser'),
    ('44039f5d-30f1-4bde-a00d-b780185bd7df', 'professional')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

-- 3. Crear un paciente de prueba genérico para poder asignarle turnos
DO $$
DECLARE
  v_patient_id UUID;
BEGIN
  INSERT INTO public.patients (user_id, first_name, last_name, document_id, phone)
  VALUES ('e09b1032-3ab8-43b0-8ed9-f9931395e4dc', 'Paciente', 'De Prueba', '11223344', '555-1234')
  RETURNING id INTO v_patient_id;

  -- 4. Insertar turnos de prueba para Martina Johnston
  INSERT INTO public.appointments (user_id, professional_id, patient_id, date, start_time, end_time, service_type, status)
  VALUES 
    ('e09b1032-3ab8-43b0-8ed9-f9931395e4dc', '44039f5d-30f1-4bde-a00d-b780185bd7df', v_patient_id, CURRENT_DATE, '09:00', '11:00', 'Ortodoncia', 'Scheduled'),
    ('e09b1032-3ab8-43b0-8ed9-f9931395e4dc', '44039f5d-30f1-4bde-a00d-b780185bd7df', v_patient_id, CURRENT_DATE, '13:00', '14:00', 'Implantes', 'Scheduled');
END $$;

-- 5. Volver a habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
