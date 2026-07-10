"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { format, addDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from '@/utils/supabase/client';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (appointments.length > 0 && scrollContainerRef.current) {
      // Find the earliest start time
      let earliestHour = 24;
      appointments.forEach(apt => {
        const hour = parseInt((apt.start_time || "09:00").split(':')[0]);
        if (hour < earliestHour) earliestHour = hour;
      });
      if (earliestHour >= 6) {
        const pixelsToScroll = (earliestHour - 6) * 80;
        scrollContainerRef.current.scrollTo({ top: Math.max(0, pixelsToScroll - 40), behavior: 'smooth' });
      }
    }
  }, [appointments]);

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
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      const { data: allAppts } = await supabase
        .from('appointments')
        .select('*, patient:patients(id, first_name, last_name, document_id, health_insurances(name))');
        
      const appts = (allAppts || []).filter(a => a.date === formattedDate);
      appts.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
        
      setAppointments(appts);

      // Contar turnos específicos de HOY para el KPI
      if (startOfDay(today).getTime() === startOfDay(selectedDate).getTime()) {
        setTurnosHoy(appts.length);
      } else {
        const formattedToday = format(today, 'yyyy-MM-dd');
        const countToday = (allAppts || []).filter(a => a.date === formattedToday).length;
        setTurnosHoy(countToday);
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

  const isSelectedToday = format(selectedDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
  let titleText = format(selectedDate, "EEEE d 'de' MMMM", { locale: es });
  if (isSelectedToday) {
    titleText = `Hoy, ${titleText}`;
  } else {
    titleText = `${titleText} de ${format(selectedDate, 'yyyy')}`;
  }
  const capitalizedTitle = titleText.charAt(0).toUpperCase() + titleText.slice(1);

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
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-md mb-xl">
        {/* Card 1: Pacientes Totales */}
        <Link href="/patients" className="bg-bina-crema p-4 md:p-md rounded-2xl border border-bina-taupe/10 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-1 md:mb-2">
            <span className="font-label-md text-bina-taupe uppercase tracking-wider font-semibold opacity-80 group-hover:opacity-100 transition-opacity">Pacientes Totales</span>
            <span className="material-symbols-outlined text-bina-taupe opacity-70 group-hover:scale-110 transition-transform">group</span>
          </div>
          <div className="flex items-end gap-2">
            <h2 className="text-3xl lg:text-4xl font-bold text-bina-taupe">{totalPacientes}</h2>
          </div>
        </Link>

        {/* Card 2: Turnos Hoy */}
        <Link href="/calendar" className="bg-bina-taupe/10 p-4 md:p-md rounded-2xl border border-bina-taupe/10 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-1 md:mb-2">
            <span className="font-label-md text-bina-taupe uppercase tracking-wider font-semibold opacity-80 group-hover:opacity-100 transition-opacity">Turnos Hoy</span>
            <span className="material-symbols-outlined text-bina-taupe opacity-70 group-hover:scale-110 transition-transform">event</span>
          </div>
          <div className="flex items-end gap-2">
            <h2 className="text-3xl lg:text-4xl font-bold text-bina-taupe">{turnosHoy}</h2>
          </div>
        </Link>

        {/* Card 3: Pagos Pendientes */}
        <Link href="/finance" className="bg-bina-madera/15 p-4 md:p-md rounded-2xl border border-bina-madera/20 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-1 md:mb-2">
            <span className="font-label-md text-bina-taupe uppercase tracking-wider font-semibold opacity-80 group-hover:opacity-100 transition-opacity">Pacientes con Deuda</span>
            <span className="material-symbols-outlined text-bina-taupe opacity-70 group-hover:scale-110 transition-transform">payments</span>
          </div>
          <div className="flex items-end gap-2">
            <h2 className="text-3xl lg:text-4xl font-bold text-bina-taupe">{pacientesConDeuda}</h2>
          </div>
        </Link>
      </section>

      {/* Main Content: Agenda & Insights */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-gutter">
        
        {/* Agenda */}
        <section className="xl:col-span-2 flex flex-col gap-6">
          <Link href="/calendar">
            <div className="bg-primary-container/40 rounded-2xl border border-primary/20 shadow-sm p-lg flex flex-col md:flex-row items-center justify-between cursor-pointer hover:bg-primary-container/60 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-3xl">calendar_today</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-on-surface">{capitalizedTitle}</h3>
                  <p className="text-on-surface-variant text-lg">En agenda: <span className="font-bold text-primary">{turnosHoy} turnos</span></p>
                </div>
              </div>
              <div className="mt-4 md:mt-0 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-md flex items-center gap-2 hover:shadow-lg transition-shadow">
                Ver agenda completa
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </div>
            </div>
          </Link>

          <div className="bg-surface-container-lowest rounded-2xl border border-tertiary-fixed shadow-[0px_4px_20px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col h-auto min-h-[400px]">
            {/* Header Agenda Table */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-6 border-b border-outline-variant/30 gap-4">
              <h3 className="font-headline-md font-bold text-on-surface">Turnos del Día</h3>
              
              {/* Date Selector (Horizontal) */}
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"><span className="material-symbols-outlined">chevron_left</span></button>
                <div className="px-4 py-2 border border-outline-variant rounded-lg font-label-md flex items-center gap-2 text-primary font-bold">
                  {format(selectedDate, "dd MMMM yyyy", { locale: es })}
                </div>
                <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"><span className="material-symbols-outlined">chevron_right</span></button>
              </div>
            </div>

            {/* Table View */}
            <div className="flex-1 overflow-x-auto relative">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="p-8 text-center text-on-surface-variant">Cargando agenda...</div>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-surface-container/30 border-b border-outline-variant/30 text-on-surface-variant font-medium text-sm">
                      <th className="p-4 pl-6 font-semibold w-24">Horario</th>
                      <th className="p-4 font-semibold">Paciente</th>
                      <th className="p-4 font-semibold">Obra Social</th>
                      <th className="p-4 pr-6 font-semibold">Práctica</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-on-surface-variant">
                          <div className="flex flex-col items-center gap-2 opacity-60">
                            <span className="material-symbols-outlined text-4xl">event_busy</span>
                            <p>No hay turnos registrados para esta fecha.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      appointments.map((apt) => (
                        <tr key={apt.id} onClick={() => router.push(`/patients/${apt.patient?.id}`)} className={`border-b border-outline-variant/20 hover:bg-surface-container-lowest/50 transition-colors cursor-pointer group ${apt.status === 'ausente' ? 'opacity-50' : ''}`}>
                          <td className="p-4 pl-6 font-bold text-on-surface group-hover:text-primary transition-colors">
                            {apt.start_time ? apt.start_time.slice(0, 5) : "--:--"}
                          </td>
                          <td className={`p-4 text-on-surface font-semibold flex items-center gap-2 ${apt.status === 'ausente' ? 'line-through text-on-surface-variant' : ''}`}>
                            {apt.status === 'asistio' ? (
                               <div className="w-8 h-8 rounded-full bg-[#10B981]/10 flex items-center justify-center text-[#10B981] text-xs">
                                 <span className="material-symbols-outlined text-[16px]">check_circle</span>
                               </div>
                            ) : apt.status === 'ausente' ? (
                               <div className="w-8 h-8 rounded-full bg-error/10 flex items-center justify-center text-error text-xs">
                                 <span className="material-symbols-outlined text-[16px]">cancel</span>
                               </div>
                            ) : (
                               <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">
                                 <span className="material-symbols-outlined text-[16px]">person</span>
                               </div>
                            )}
                            {apt.patient?.first_name} {apt.patient?.last_name}
                          </td>
                          <td className="p-4 text-on-surface-variant text-sm">
                            {apt.patient?.health_insurances?.name || "Particular"}
                          </td>
                          <td className="p-4 pr-6">
                            {apt.service_type && apt.service_type.trim() !== '' ? (
                               <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold whitespace-nowrap">
                                 {apt.service_type}
                               </span>
                            ) : (
                              <span className="text-on-surface-variant/40 text-sm italic">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
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
