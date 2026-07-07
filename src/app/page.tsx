"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { format, addDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from '@/utils/supabase/client';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [greeting, setGreeting] = useState("Buenos días");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("Usuario");
  
  // Datos reales
  const [totalPacientes, setTotalPacientes] = useState(0);
  const [turnosHoy, setTurnosHoy] = useState(0);
  const [pacientesConDeuda, setPacientesConDeuda] = useState(0);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);

  // Fechas para el selector horizontal
  const today = new Date();
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(today, i - 1)); // Ayer, Hoy, +5 días
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 12 && hour < 20) setGreeting("Buenas tardes");
    else if (hour >= 20) setGreeting("Buenas noches");
    
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Obtener usuario y rol
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const meta = session.user.user_metadata;
        const firstName = meta?.first_name;
        if (firstName) {
          setUserName(firstName);
        } else {
          setUserName(""); // If empty, the UI uses {userName || role} fallback
        }
        const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).single();
        if (roleData) {
          if (roleData.role === 'secretary') setRole('Secretaría');
          else if (roleData.role === 'professional') setRole('Profesional');
          else setRole('Administrador');
        }
      }

      // 2. Total Pacientes
      const { count } = await supabase.from('patients').select('*', { count: 'exact', head: true });
      setTotalPacientes(count || 0);

      // 3. Turnos (para la fecha seleccionada)
      const start = startOfDay(selectedDate).toISOString();
      const end = endOfDay(selectedDate).toISOString();
      const { data: appts } = await supabase
        .from('appointments')
        .select('*, patient:patients(id, first_name, last_name, document_id)')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true });
        
      setAppointments(appts || []);

      // Contar turnos específicos de HOY para el KPI
      if (startOfDay(today).getTime() === startOfDay(selectedDate).getTime()) {
        setTurnosHoy(appts?.length || 0);
      } else {
        const startT = startOfDay(today).toISOString();
        const endT = endOfDay(today).toISOString();
        const { count: countToday } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('date', startT).lte('date', endT);
        setTurnosHoy(countToday || 0);
      }

      // 4. Deudas (Pagos Pendientes)
      const { data: bills } = await supabase
        .from('bills')
        .select('*, payments:bill_payments(amount), patient:patients(id, first_name, last_name)');
      
      if (bills) {
        let debts: any[] = [];
        let debtorSet = new Set();
        
        bills.forEach(bill => {
          if (!bill.patient) return; // Ignore bills from deleted patients
          
          const totalPaid = bill.payments.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
          const balance = Number(bill.total_amount) - totalPaid;
          if (balance > 0) {
            debtorSet.add(bill.patient_id);
            debts.push({
              id: bill.id,
              patient_id: bill.patient_id,
              patient: `${bill.patient.first_name} ${bill.patient.last_name}`,
              amount: balance,
              desc: "Saldo de presupuesto"
            });
          }
        });
        
        setPacientesConDeuda(debtorSet.size);
        setPendingPayments(debts.slice(0, 5)); // Mostrar solo los primeros 5 en el dashboard
      }

    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  return (
    <div className="px-margin-mobile md:px-margin-desktop pb-xl pt-lg">
      
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-md mb-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            {greeting}, {userName || role}!
          </h1>
        </div>
      </section>

      {/* KPI Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-md mb-xl">
        {/* Card 1: Pacientes Totales */}
        <Link href="/patients" className="bg-bina-crema p-md rounded-2xl border border-bina-taupe/10 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-2">
            <span className="font-label-md text-bina-taupe uppercase tracking-wider font-semibold opacity-80 group-hover:opacity-100 transition-opacity">Pacientes Totales</span>
            <span className="material-symbols-outlined text-bina-taupe opacity-70 group-hover:scale-110 transition-transform">group</span>
          </div>
          <div className="flex items-end gap-2">
            <h2 className="text-4xl md:text-3xl lg:text-4xl font-bold text-bina-taupe">{totalPacientes}</h2>
          </div>
        </Link>

        {/* Card 2: Turnos Hoy */}
        <Link href="/calendar" className="bg-bina-taupe/10 p-md rounded-2xl border border-bina-taupe/10 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-2">
            <span className="font-label-md text-bina-taupe uppercase tracking-wider font-semibold opacity-80 group-hover:opacity-100 transition-opacity">Turnos Hoy</span>
            <span className="material-symbols-outlined text-bina-taupe opacity-70 group-hover:scale-110 transition-transform">event</span>
          </div>
          <div className="flex items-end gap-2">
            <h2 className="text-4xl md:text-3xl lg:text-4xl font-bold text-bina-taupe">{turnosHoy}</h2>
          </div>
        </Link>

        {/* Card 3: Pagos Pendientes */}
        <Link href="/finance" className="bg-bina-madera/15 p-md rounded-2xl border border-bina-madera/20 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-2">
            <span className="font-label-md text-bina-taupe uppercase tracking-wider font-semibold opacity-80 group-hover:opacity-100 transition-opacity">Pacientes con Deuda</span>
            <span className="material-symbols-outlined text-bina-taupe opacity-70 group-hover:scale-110 transition-transform">payments</span>
          </div>
          <div className="flex items-end gap-2">
            <h2 className="text-4xl md:text-3xl lg:text-4xl font-bold text-bina-taupe">{pacientesConDeuda}</h2>
          </div>
        </Link>
      </section>

      {/* Main Content: Agenda & Insights */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-gutter">
        
        {/* Agenda */}
        <section className="xl:col-span-2">
          <div className="bg-surface-container-lowest rounded-2xl border border-tertiary-fixed shadow-[0px_4px_20px_rgba(0,0,0,0.03)] p-lg overflow-hidden flex flex-col h-auto min-h-[400px] lg:h-[500px]">
            
            {/* Header Agenda */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-headline-md font-bold text-on-surface">Agenda Clínica</h3>
              <div className="px-4 py-2 border border-outline-variant rounded-lg font-label-md flex items-center gap-2 cursor-pointer hover:bg-surface-container transition-colors">
                {format(selectedDate, "MMMM yyyy", { locale: es })}
              </div>
            </div>

            {/* Date Selector (Horizontal) */}
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-outline-variant/30 px-2">
              <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"><span className="material-symbols-outlined">chevron_left</span></button>
              
              <div className="flex gap-2 md:gap-4 overflow-x-auto no-scrollbar">
                {weekDays.map((d, i) => {
                  const isSelected = format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                  return (
                    <button 
                      key={i}
                      onClick={() => setSelectedDate(d)}
                      className={`flex flex-col items-center justify-center w-12 h-14 md:w-14 md:h-16 rounded-2xl transition-all ${
                        isSelected ? 'bg-on-surface text-surface shadow-md scale-105' : 'text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      <span className="text-xs uppercase font-medium">{format(d, 'eee', { locale: es })}</span>
                      <span className="text-lg font-bold">{format(d, 'dd')}</span>
                    </button>
                  );
                })}
              </div>

              <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"><span className="material-symbols-outlined">chevron_right</span></button>
            </div>

            {/* Appointment List */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {isLoading ? (
                <div className="p-8 text-center text-on-surface-variant">Cargando agenda...</div>
              ) : appointments.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant flex flex-col items-center">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-50">event_available</span>
                  No hay turnos para esta fecha.
                </div>
              ) : appointments.map((apt) => (
                <div 
                  key={apt.id} 
                  onClick={() => router.push(`/patients/${apt.patient?.id}`)}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border border-outline-variant/40 rounded-xl hover:border-primary-container hover:shadow-sm transition-all group cursor-pointer bg-surface/30"
                >
                  {/* Paciente y Doc */}
                  <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2 md:gap-8">
                    <div className="flex flex-col min-w-[150px]">
                      <span className="font-bold text-on-surface text-base group-hover:text-primary transition-colors">
                        {apt.patient?.first_name} {apt.patient?.last_name}
                      </span>
                      <span className="text-xs text-on-surface-variant uppercase tracking-wider">Paciente</span>
                    </div>
                    
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center gap-1.5 text-on-surface font-medium text-sm">
                        <span className="material-symbols-outlined text-[16px] text-primary">schedule</span>
                        {format(parseISO(`1970-01-01T${apt.start_time}`), "HH:mm")} - {format(parseISO(`1970-01-01T${apt.end_time}`), "HH:mm")}
                      </div>
                      <div className="flex items-center gap-1.5 text-on-surface-variant text-sm mt-0.5">
                        <span className="material-symbols-outlined text-[16px]">notes</span>
                        {apt.notes || "Sin notas adicionales"}
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 sm:w-auto w-full border-t sm:border-t-0 border-outline-variant/30 pt-3 sm:pt-0">
                    <span className="material-symbols-outlined text-on-surface-variant opacity-50 group-hover:opacity-100 transition-opacity">arrow_forward_ios</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Panel lateral: Pagos pendientes rediseñados */}
        <section className="flex flex-col gap-md">
          <div className="bg-surface-container-lowest rounded-[2rem] border border-outline-variant/50 shadow-sm overflow-hidden flex flex-col h-auto min-h-[400px] lg:h-[500px]">
            <div className="p-5 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-low/30">
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-error">receipt_long</span>
                Pagos Pendientes
              </h2>
              <Link href="/finance" className="text-xs font-bold text-primary hover:underline">Ver Todos</Link>
            </div>
            
            <div className="p-4 space-y-3 overflow-y-auto no-scrollbar flex-1">
              {isLoading ? (
                <div className="text-center text-on-surface-variant text-sm mt-8">Cargando deudas...</div>
              ) : pendingPayments.length === 0 ? (
                <div className="text-center text-on-surface-variant text-sm mt-8 flex flex-col items-center">
                  <span className="material-symbols-outlined text-3xl mb-2 opacity-50">check_circle</span>
                  No hay pagos pendientes registrados.
                </div>
              ) : pendingPayments.map((tx, i) => (
                <div 
                  key={i} 
                  onClick={() => router.push(`/patients/${tx.patient_id}`)}
                  className="flex items-center justify-between p-3 rounded-xl border border-outline-variant/40 hover:bg-surface-container hover:border-primary-container transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-error/10 text-error shrink-0">
                      <span className="material-symbols-outlined text-[20px]">
                        account_balance_wallet
                      </span>
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-bold text-on-surface text-sm truncate">{tx.patient}</div>
                      <div className="text-[11px] font-medium text-on-surface-variant truncate">{tx.desc}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-sm text-error">${tx.amount.toLocaleString('es-AR')}</div>
                    <div className="text-[10px] font-bold text-on-surface-variant uppercase group-hover:text-primary transition-colors">
                      Ver Ficha
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {pendingPayments.length > 0 && (
              <div className="p-4 border-t border-outline-variant/30 text-center">
                <Link href="/finance" className="text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">
                  Ver reporte completo
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
