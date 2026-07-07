-- 1. Asegurar que está habilitada la extensión uuid y limpiar si ya existían tablas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS public.clinical_notes CASCADE;
DROP TABLE IF EXISTS public.budget_items CASCADE;
DROP TABLE IF EXISTS public.budgets CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.health_insurance_fees CASCADE;
DROP TABLE IF EXISTS public.health_insurances CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;


-- 2. Crear Tabla de Roles (RBAC)
CREATE TABLE public.user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('superuser', 'professional', 'secretary')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Función ayudante para obtener el rol del usuario actual rápidamente (optimizado)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Crear Tablas Principales

CREATE TABLE public.health_insurances (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    contact_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.health_insurance_fees (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    health_insurance_id UUID NOT NULL REFERENCES public.health_insurances(id) ON DELETE CASCADE,
    treatment_name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    effective_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.patients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    health_insurance_id UUID REFERENCES public.health_insurances(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    document_id TEXT,
    phone TEXT,
    email TEXT,
    birth_date DATE,
    blood_type TEXT,
    allergies TEXT,
    
    -- Nuevos campos de la Historia Clínica General y Odontológica
    affiliate_number TEXT,
    address TEXT,
    occupation TEXT,
    medical_treatments TEXT,
    systemic_diseases TEXT,
    infectious_diseases TEXT,
    specific_conditions TEXT,
    surgeries TEXT,
    habits TEXT,
    
    main_complaint TEXT,
    pain_history TEXT,
    dental_trauma TEXT,
    functional_difficulties TEXT,
    treatment_plan TEXT,
    
    odontogram_state JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.appointments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- User who created it
    professional_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Professional assigned
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    service_type TEXT NOT NULL DEFAULT 'Consulta General',
    status TEXT DEFAULT 'Scheduled',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.budgets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.budget_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    value DECIMAL(10, 2) NOT NULL
);

CREATE TABLE public.clinical_notes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    tooth_id TEXT,
    description TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- --------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) BASADO EN ROLES
-- --------------------------------------------------------

-- Habilitar RLS en todas las tablas
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

-- user_roles: Un usuario solo puede ver su propio rol
CREATE POLICY "Users can view their own role" 
ON public.user_roles FOR SELECT 
USING (auth.uid() = user_id);

-- --------------------------------------------------------
-- PACIENTES (patients)
-- Superuser / Secretary: Pueden ver TODOS
-- Professional: Solo ven LOS SUYOS
-- --------------------------------------------------------
CREATE POLICY "Role based SELECT on patients" 
ON public.patients FOR SELECT 
USING (
  (public.get_my_role() IN ('superuser', 'secretary'))
  OR 
  (auth.uid() = user_id)
);

CREATE POLICY "Role based INSERT on patients" 
ON public.patients FOR INSERT 
WITH CHECK (
  (public.get_my_role() IN ('superuser', 'secretary'))
  OR 
  (auth.uid() = user_id)
);

CREATE POLICY "Role based UPDATE on patients" 
ON public.patients FOR UPDATE 
USING (
  (public.get_my_role() IN ('superuser', 'secretary'))
  OR 
  (auth.uid() = user_id)
);

CREATE POLICY "Role based DELETE on patients" 
ON public.patients FOR DELETE 
USING (
  (public.get_my_role() IN ('superuser', 'secretary'))
  OR 
  (auth.uid() = user_id)
);


-- --------------------------------------------------------
-- OBRAS SOCIALES
-- Todos pueden ver. Solo SuperUser y Secretaria pueden editar.
-- --------------------------------------------------------
ALTER TABLE public.health_insurances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_insurance_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role based SELECT on insurances" ON public.health_insurances FOR SELECT USING (true);
CREATE POLICY "Role based INSERT on insurances" ON public.health_insurances FOR INSERT WITH CHECK (public.get_my_role() IN ('superuser', 'secretary'));
CREATE POLICY "Role based UPDATE on insurances" ON public.health_insurances FOR UPDATE USING (public.get_my_role() IN ('superuser', 'secretary'));
CREATE POLICY "Role based DELETE on insurances" ON public.health_insurances FOR DELETE USING (public.get_my_role() IN ('superuser', 'secretary'));

CREATE POLICY "Role based SELECT on fees" ON public.health_insurance_fees FOR SELECT USING (true);
CREATE POLICY "Role based INSERT on fees" ON public.health_insurance_fees FOR INSERT WITH CHECK (public.get_my_role() IN ('superuser', 'secretary'));
CREATE POLICY "Role based UPDATE on fees" ON public.health_insurance_fees FOR UPDATE USING (public.get_my_role() IN ('superuser', 'secretary'));
CREATE POLICY "Role based DELETE on fees" ON public.health_insurance_fees FOR DELETE USING (public.get_my_role() IN ('superuser', 'secretary'));

-- --------------------------------------------------------
-- CITAS (appointments) y NOTAS (clinical_notes)
-- Mismas reglas que los pacientes (Secretarias y SuperUsers ven todo)
-- --------------------------------------------------------
CREATE POLICY "Role based SELECT on appointments" ON public.appointments FOR SELECT USING ((public.get_my_role() IN ('superuser', 'secretary')) OR (auth.uid() = professional_id) OR (auth.uid() = user_id));
CREATE POLICY "Role based INSERT on appointments" ON public.appointments FOR INSERT WITH CHECK ((public.get_my_role() IN ('superuser', 'secretary')) OR (auth.uid() = professional_id) OR (auth.uid() = user_id));
CREATE POLICY "Role based UPDATE on appointments" ON public.appointments FOR UPDATE USING ((public.get_my_role() IN ('superuser', 'secretary')) OR (auth.uid() = professional_id) OR (auth.uid() = user_id));
CREATE POLICY "Role based DELETE on appointments" ON public.appointments FOR DELETE USING ((public.get_my_role() IN ('superuser', 'secretary')) OR (auth.uid() = professional_id) OR (auth.uid() = user_id));

CREATE POLICY "Role based SELECT on notes" ON public.clinical_notes FOR SELECT USING ((public.get_my_role() IN ('superuser', 'secretary')) OR (auth.uid() = user_id));
CREATE POLICY "Role based INSERT on notes" ON public.clinical_notes FOR INSERT WITH CHECK ((public.get_my_role() IN ('superuser', 'secretary')) OR (auth.uid() = user_id));
CREATE POLICY "Role based UPDATE on notes" ON public.clinical_notes FOR UPDATE USING ((public.get_my_role() IN ('superuser', 'secretary')) OR (auth.uid() = user_id));
CREATE POLICY "Role based DELETE on notes" ON public.clinical_notes FOR DELETE USING ((public.get_my_role() IN ('superuser', 'secretary')) OR (auth.uid() = user_id));


-- --------------------------------------------------------
-- FINANZAS (budgets y budget_items)
-- SECRETARIA: BLOQUEADO ABSOLUTAMENTE (NO VE NADA)
-- Superuser: Ve TODO
-- Professional: Ve LOS SUYOS
-- --------------------------------------------------------
CREATE POLICY "Role based SELECT on budgets" 
ON public.budgets FOR SELECT 
USING (
  (public.get_my_role() = 'superuser')
  OR 
  (auth.uid() = user_id AND public.get_my_role() = 'professional')
);

CREATE POLICY "Role based INSERT on budgets" 
ON public.budgets FOR INSERT 
WITH CHECK (
  (public.get_my_role() = 'superuser')
  OR 
  (auth.uid() = user_id AND public.get_my_role() = 'professional')
);

CREATE POLICY "Role based UPDATE on budgets" 
ON public.budgets FOR UPDATE 
USING (
  (public.get_my_role() = 'superuser')
  OR 
  (auth.uid() = user_id AND public.get_my_role() = 'professional')
);

CREATE POLICY "Role based DELETE on budgets" 
ON public.budgets FOR DELETE 
USING (
  (public.get_my_role() = 'superuser')
  OR 
  (auth.uid() = user_id AND public.get_my_role() = 'professional')
);

-- (Igual para budget_items)
CREATE POLICY "Role based SELECT on budget_items" 
ON public.budget_items FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.budgets 
    WHERE public.budgets.id = public.budget_items.budget_id 
    AND (
      (public.get_my_role() = 'superuser')
      OR 
      (public.budgets.user_id = auth.uid() AND public.get_my_role() = 'professional')
    )
  )
);

CREATE POLICY "Role based INSERT on budget_items" ON public.budget_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.budgets WHERE public.budgets.id = budget_id AND (
      (public.get_my_role() = 'superuser') OR (public.budgets.user_id = auth.uid() AND public.get_my_role() = 'professional')
    )
  )
);
CREATE POLICY "Role based UPDATE on budget_items" ON public.budget_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.budgets WHERE public.budgets.id = public.budget_items.budget_id AND (
      (public.get_my_role() = 'superuser') OR (public.budgets.user_id = auth.uid() AND public.get_my_role() = 'professional')
    )
  )
);
CREATE POLICY "Role based DELETE on budget_items" ON public.budget_items FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.budgets WHERE public.budgets.id = public.budget_items.budget_id AND (
      (public.get_my_role() = 'superuser') OR (public.budgets.user_id = auth.uid() AND public.get_my_role() = 'professional')
    )
  )
);
