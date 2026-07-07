-- Create bills table (represents a group of realized treatments on a specific date)
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create bill items (individual treatments)
CREATE TABLE IF NOT EXISTS public.bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    value DECIMAL(10,2) NOT NULL
);

-- Create bill payments
CREATE TABLE IF NOT EXISTS public.bill_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Set up RLS
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;

-- Policies for bills
CREATE POLICY "Allow anonymous read access on bills" ON public.bills FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access on bills" ON public.bills FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access on bills" ON public.bills FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete access on bills" ON public.bills FOR DELETE USING (true);

-- Policies for bill_items
CREATE POLICY "Allow anonymous read access on bill_items" ON public.bill_items FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access on bill_items" ON public.bill_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access on bill_items" ON public.bill_items FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete access on bill_items" ON public.bill_items FOR DELETE USING (true);

-- Policies for bill_payments
CREATE POLICY "Allow anonymous read access on bill_payments" ON public.bill_payments FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access on bill_payments" ON public.bill_payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access on bill_payments" ON public.bill_payments FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete access on bill_payments" ON public.bill_payments FOR DELETE USING (true);

-- Grant privileges
GRANT ALL ON TABLE public.bills TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.bill_items TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.bill_payments TO anon, authenticated, service_role;

-- Update Schema Cache Notification
NOTIFY pgrst, 'reload schema';
