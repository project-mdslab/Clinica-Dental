'use client'
import { useState, useEffect, useRef } from 'react';
import { format, addMonths, subMonths, startOfWeek, addDays, isSameMonth, isSameDay, startOfMonth, endOfMonth, endOfWeek, isToday, parseISO, getDay, getHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { createClient } from '@/utils/supabase/client';
import AlertDialog from '@/components/AlertDialog';
import Link from 'next/link';
import NewAppointmentModal from '@/components/NewAppointmentModal';
import Portal from '@/components/Portal';
import ServicesConfigModal from '@/components/ServicesConfigModal';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentTime] = useState(new Date());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [userRole, setUserRole] = useState<'secretary' | 'professional'>('secretary');
  const [currentUserId, setCurrentUserId] = useState('');
  
  // Estado de Sincronización
  const [isSyncing, setIsSyncing] = useState(false);

  // Instancia de Supabase
  const supabase = createClient();

  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [appointmentToEdit, setAppointmentToEdit] = useState<any>(null);
  const [draggedEvent, setDraggedEvent] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'alert' as 'alert' | 'confirm', onConfirm: () => {}, confirmText: 'Aceptar' });
  const [isNewAppointmentModalOpen, setIsNewAppointmentModalOpen] = useState(false);
  const [selectedTimeForNew, setSelectedTimeForNew] = useState<string | undefined>(undefined);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isServicesConfigOpen, setIsServicesConfigOpen] = useState(false);
  const [isProfessionalsExpanded, setIsProfessionalsExpanded] = useState(true);
  const [isServicesExpanded, setIsServicesExpanded] = useState(true);
  const [isGuardiasModalOpen, setIsGuardiasModalOpen] = useState(false);
  const [toast, setToast] = useState<{message: string, visible: boolean, type: 'success' | 'error'}>({message: '', visible: false, type: 'success'});

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, visible: true, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 4000);
  };

  // Prestaciones dinámicas
  const [services, setServices] = useState<{id?: string, name: string, color: string}[]>([]);
  const [newServiceName, setNewServiceName] = useState('');
  const [professionals, setProfessionals] = useState<any[]>([]);

  // Horarios No Hábiles
  const [unavailabilities, setUnavailabilities] = useState<{professional_id: string, dayOfWeek: number, startHour: number, endHour: number}[]>([]);

  const handleAttendance = async (status: 'asistio' | 'ausente') => {
    try {
      if (!selectedAppointment) {
        console.error('No selected appointment');
        return;
      }
      
      console.log('Marking attendance:', status, selectedAppointment.id);
      
      // 1. Update the appointment status
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', selectedAppointment.id);

      if (error) {
        console.error('Supabase update error:', error);
        showAlert('Error al actualizar el estado: ' + error.message);
        return;
      }

      // 2. Insert a clinical note for the attendance record
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
         console.error('Auth error:', authError);
      }
      
      if (user) {
        const attendanceText = status === 'asistio' ? 'Paciente asistió al turno programado.' : 'Paciente AUSENTE al turno programado.';
        const { error: insertError } = await supabase.from('clinical_notes').insert([{
          patient_id: selectedAppointment.patient_id,
          user_id: user.id,
          description: attendanceText,
          date: selectedAppointment.date
        }]);
        if (insertError) {
           console.error('Insert note error:', insertError);
        }
      } else {
         console.warn('No user found, skipping clinical note insertion');
      }

      // 3. Close modal and refresh data
      setSelectedAppointment(null);
      await fetchCalendarData();
      showToast(`El turno fue marcado como ${status === 'asistio' ? 'Asistió' : 'Ausente'}.`, 'success');
    } catch (e: any) {
      console.error('Unexpected error in handleAttendance:', e);
      showToast('Error inesperado: ' + e.message, 'error');
    }
  };

  // Calcular próximo paciente (considerando el rol)
  const currentHourNum = currentTime.getHours();
  const sortedTodayEvents = events
    .filter(ev => ev.date === format(new Date(), 'yyyy-MM-dd') && (userRole === 'secretary' || ev.professional_id === currentUserId))
    .sort((a, b) => a.startHour - b.startHour);
  const nextEvent = sortedTodayEvents.find(ev => ev.startHour >= currentHourNum);

  const showAlert = (message: string, title?: string) => {
    setAlertDialog({ isOpen: true, title: title || 'Atención', message, type: 'alert', onConfirm: () => setAlertDialog(prev => ({ ...prev, isOpen: false })), confirmText: 'Aceptar' });
  };

  // Fetch Professionals and Appointments
  const fetchCalendarData = async () => {
    // Fetch professionals
    const { data: profs, error: profErr } = await supabase.rpc('get_professionals');
    if (profErr) {
      console.error("Error fetching professionals:", profErr);
    }
    const realProfessionals = profs || [];
    setProfessionals(realProfessionals);

    // Carga Inteligente: Solo traemos 2 meses hacia atrás y 3 meses hacia adelante
    const startRange = format(subMonths(currentDate, 2), 'yyyy-MM-dd');
    const endRange = format(addMonths(currentDate, 3), 'yyyy-MM-dd');

    // Fetch appointments
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patients(first_name, last_name, id)')
      .gte('date', startRange)
      .lte('date', endRange);
      
    if (error) {
      console.error("Error fetching appointments:", error);
      return;
    }
    
    if (data) {
      const formattedEvents = data.map(app => {
        const appointmentDate = parseISO(app.date);
        const assignedProf = realProfessionals.find((p: any) => p.id === app.professional_id) || { name: 'Profesional Desconocido', id: app.professional_id };

        const startParts = app.start_time.split(':');
        const endParts = app.end_time.split(':');
        const startHour = parseInt(startParts[0]);
        const startMinute = parseInt(startParts[1] || '0');
        const endHour = parseInt(endParts[0]);
        const endMinute = parseInt(endParts[1] || '0');
        const durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);

        return {
          id: app.id,
          title: app.service_type,
          professional: assignedProf.name,
          professional_id: assignedProf.id,
          patient: app.patients ? `${app.patients.first_name} ${app.patients.last_name}` : 'Paciente Eliminado',
          patient_id: app.patient_id,
          type: app.service_type,
          startHour: startHour,
          startMinute: startMinute,
          durationMinutes: durationMinutes,
          start_time: app.start_time,
          end_time: app.end_time,
          dayIdx: getDay(appointmentDate), // 0 Sunday, 1 Monday, etc.
          date: app.date,
          status: app.status || 'Registrado'
        };
      });
      setEvents(formattedEvents);
    }
  };

  const fetchServices = async () => {
    const { data, error } = await supabase.from('calendar_services').select('id, name, color').order('created_at', { ascending: true });
    if (data) {
      setServices(data);
    }
  };

  // Volver a cargar si cambiamos de mes (Carga Inteligente)
  useEffect(() => {
    fetchCalendarData();
  }, [format(currentDate, 'yyyy-MM')]);

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single();
        if (data) setUserRole(data.role as any);
      }
    };
    
    fetchUserRole();
    fetchCalendarData();

    // Supabase Realtime Subscriptions
    const channel = supabase.channel('calendar-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchCalendarData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_services' }, () => {
        fetchServices();
      })
      .subscribe();

    fetchServices();

    const storedUnav = localStorage.getItem('clinic_unavailabilities');
    if (storedUnav) {
      setUnavailabilities(JSON.parse(storedUnav));
    } else {
      setUnavailabilities([]);
      localStorage.setItem('clinic_unavailabilities', JSON.stringify([]));
    }

    // Set mobile view
    if (window.innerWidth < 768) {
      setView('day');
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-scroll al horario actual
  useEffect(() => {
    if (view === 'day' || view === 'week') {
      if (scrollContainerRef.current) {
        // En lugar de ir al primer turno, vamos a la hora actual (o 1 hora antes para dar margen)
        const currentHour = new Date().getHours();
        const targetHour = Math.max(6, currentHour - 1);
        const pixelsToScroll = (targetHour - 6) * 80;
        
        // Hacemos el scroll suave
        scrollContainerRef.current.scrollTo({ top: Math.max(0, pixelsToScroll), behavior: 'smooth' });
      }
    }
  }, [view, currentDate]);

  // Notificación de Guardias para el día de mañana
  useEffect(() => {
    if (events.length === 0) return;
    
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const guardiasTomorrow = events.filter(ev => ev.title === 'GUARDIA' && ev.date === tomorrow);
    
    if (guardiasTomorrow.length > 0) {
      const alreadyNotified = sessionStorage.getItem('guardia_notified_' + tomorrow);
      if (!alreadyNotified) {
        const profs = Array.from(new Set(guardiasTomorrow.map(g => g.professional))).join(', ');
        showAlert(`¡Atención! Mañana hay Guardia programada a cargo de: ${profs}.`, 'Recordatorio de Guardia 🔔');
        sessionStorage.setItem('guardia_notified_' + tomorrow, 'true');
      }
    }
  }, [events]);

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    const colors = ['bg-primary', 'bg-[#34D399]', 'bg-[#60A5FA]', 'bg-[#F59E0B]', 'bg-[#8B5CF6]', 'bg-[#EC4899]'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Save to Supabase
    const { data, error } = await supabase
      .from('calendar_services')
      .insert({ name: newServiceName.trim(), color: randomColor })
      .select()
      .single();

    if (data) {
      setServices([...services, data]);
    } else {
      console.error(error);
      const updated = [...services, { name: newServiceName.trim(), color: randomColor }];
      setServices(updated);
    }
    setNewServiceName('');
  };

  const handleDeleteService = async (name: string) => {
    const serviceToDelete = services.find(s => s.name === name);
    if (serviceToDelete && serviceToDelete.id) {
      await supabase.from('calendar_services').delete().eq('id', serviceToDelete.id);
    } else if (serviceToDelete) {
      // Fallback if no ID is present (e.g. default services not yet in DB)
      await supabase.from('calendar_services').delete().eq('name', name);
    }
    const updated = services.filter(s => s.name !== name);
    setServices(updated);
  };

  const handleDragStart = (e: React.DragEvent, event: any) => {
    setDraggedEvent(event);
    setTimeout(() => { (e.target as HTMLElement).style.opacity = '0.5'; }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedEvent(null);
  };

  const handleDrop = async (e: React.DragEvent, target: number | string, targetHour: number) => {
    e.preventDefault();
    if (!draggedEvent) return;

    let updatedEvent = { ...draggedEvent, startHour: targetHour };
    let newDateString = draggedEvent.date;
    
    if (view === 'week' && typeof target === 'number') {
      const targetDayIdx = target as number;
      updatedEvent.dayIdx = targetDayIdx;
      const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); 
      const newDate = addDays(currentWeekStart, targetDayIdx);
      newDateString = format(newDate, 'yyyy-MM-dd');
    } else if (view === 'day' && target === 'day') {
      // En vista de día normal, solo cambia la hora, no el día ni el profesional
      newDateString = format(currentDate, 'yyyy-MM-dd');
    } else if (typeof target === 'string' && target !== 'day') {
      const profId = target as string;
      const assignedProf = professionals.find(p => p.id === profId);
      if (assignedProf) {
        updatedEvent.professional_id = profId;
        updatedEvent.professional = assignedProf.name;
        newDateString = format(currentDate, 'yyyy-MM-dd');
        updatedEvent.date = newDateString;
        updatedEvent.dayIdx = getDay(currentDate);
      }
    }

    // Actualizar estado local inmediato (Optimistic UI)
    setEvents(prev => prev.map(ev => ev.id === draggedEvent.id ? updatedEvent : ev));

    const newStartTime = `${targetHour.toString().padStart(2, '0')}:00`;
    const newEndTime = `${(targetHour + draggedEvent.duration).toString().padStart(2, '0')}:00`;

    const { error } = await supabase
      .from('appointments')
      .update({ 
        date: newDateString, 
        start_time: newStartTime,
        end_time: newEndTime
      })
      .eq('id', draggedEvent.id);

    if (error) {
      console.error("Error updating appointment:", error);
      fetchCalendarData(); // Revertir si falla
    }

    setDraggedEvent(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necesario para permitir el drop
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const getEventColor = (ev: any) => {
    const profId = ev.professional_id || '';
    if (!profId) return { bg: 'bg-primary', text: 'text-primary', border: 'border-primary', lightBg: 'bg-primary-container/30' };
    
    const colors = [
      { bg: 'bg-pink-500', text: 'text-pink-600', border: 'border-pink-300', lightBg: 'bg-pink-100' },
      { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-300', lightBg: 'bg-blue-100' },
      { bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-300', lightBg: 'bg-emerald-100' },
      { bg: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-300', lightBg: 'bg-purple-100' },
      { bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-300', lightBg: 'bg-amber-100' }
    ];
    
    let hash = 0;
    for (let i = 0; i < profId.length; i++) {
      hash = profId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Funciones de renderizado para el mini calendario (panel izquierdo)
  const renderMiniCalendar = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    // Días de la semana abreviados
    const weekDays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
    
    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;
        days.push(
          <div
            key={day.toString()}
            className={`text-center py-1 text-xs font-medium cursor-pointer rounded-full transition-colors ${
              !isSameMonth(day, monthStart)
                ? "text-on-surface-variant/40"
                : isSameDay(day, currentDate)
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface hover:bg-surface-container-highest"
            }`}
            onClick={() => setCurrentDate(cloneDay)}
          >
            {formattedDate}
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7 gap-1 mt-1" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div className="bg-surface-container-low rounded-2xl p-4 shadow-sm border border-outline-variant">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-title-sm text-title-sm capitalize text-on-surface font-semibold">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </h3>
          <div className="flex gap-1">
            <button onClick={prevMonth} className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button onClick={nextMonth} className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((d) => (
            <div key={d} className="text-center text-[10px] font-bold text-on-surface-variant">{d}</div>
          ))}
        </div>
        {rows}
      </div>
    );
  };

  // Helper para la vista semanal
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Empezar en Lunes
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }

    const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM a 9 PM (21)

    return (
      <div className="flex flex-col md:h-full w-full bg-surface-container-lowest rounded-3xl border border-outline-variant shadow-sm md:overflow-hidden overflow-visible">
        {/* Contenedor scrolleable principal */}
        <div className="flex-1 md:overflow-y-auto relative scroll-smooth" ref={scrollContainerRef}>
          
          {/* Cabecera de días - STICKY */}
          <div className="sticky top-[80px] md:top-0 z-30 grid grid-cols-8 border-b border-outline-variant bg-surface-container-lowest shadow-sm">
            <div className="p-3 border-r border-outline-variant flex items-end justify-center">
              <span className="text-xs text-on-surface-variant font-medium">GMT-3</span>
            </div>
            {days.map((day) => (
              <div key={day.toString()} className="p-3 text-center border-r border-outline-variant last:border-0 flex flex-col items-center justify-center">
                <span className="text-xs font-bold uppercase text-on-surface-variant">{format(day, 'EEE', { locale: es })}</span>
                <span className={`text-2xl font-light mt-1 w-10 h-10 flex items-center justify-center rounded-full ${isToday(day) ? 'bg-primary text-on-primary' : 'text-on-surface'}`}>
                  {format(day, 'd')}
                </span>
              </div>
            ))}
          </div>
          
          {/* Cuadrícula de horas */}
          <div className="grid grid-cols-8 relative min-h-[800px]">
            {/* Columna de Horas */}
            <div className="border-r border-outline-variant flex flex-col">
              {hours.map(hour => (
                <div key={hour} className="h-20 border-b border-outline-variant/30 flex items-start justify-end p-2 text-xs text-on-surface-variant font-medium">
                  {hour}:00
                </div>
              ))}
            </div>
            
            {/* Columnas de Días */}
            {days.map((day, dayIdx) => (
              <div key={day.toString()} className="border-r border-outline-variant/30 last:border-0 relative">
                {hours.map(hour => (
                  <div 
                    key={`${day}-${hour}`} 
                    className="h-20 border-b border-outline-variant/30 hover:bg-surface-container-low/50 transition-colors cursor-pointer"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, dayIdx, hour)}
                    onClick={() => {
                      setSelectedTimeForNew(`${hour.toString().padStart(2, '0')}:00`);
                      setIsNewAppointmentModalOpen(true);
                    }}
                  >
                  </div>
                ))}

                {/* Bloques No Hábiles */}
                {unavailabilities
                  .filter(u => u.dayOfWeek === getDay(day))
                  .map((u, idx) => {
                    const top = (u.startHour - 6) * 80;
                    const height = (u.endHour - u.startHour) * 80;
                    return (
                      <div key={`unav-w-${dayIdx}-${idx}`} className="absolute left-0 right-0 bg-[repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6_10px,#ffffff_10px,#ffffff_20px)] border-y border-outline-variant/50 opacity-60 pointer-events-none flex items-center justify-center z-[5]" style={{ top: `${top}px`, height: `${height}px` }}>
                         <span className="bg-surface/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-bold text-on-surface-variant shadow-sm border border-outline-variant truncate max-w-[90%]">
                           No Hábil
                         </span>
                      </div>
                    );
                  })
                }

                {/* Eventos */}
                {events.filter(ev => ev.date === format(day, 'yyyy-MM-dd')).map(ev => {
                  const top = (ev.startHour - 6 + (ev.startMinute || 0) / 60) * 80;
                  const height = (ev.durationMinutes / 60) * 80;
                  const colors = getEventColor(ev);
                  const endH = Math.floor(ev.startHour + (ev.startMinute + ev.durationMinutes) / 60);
                  const endM = (ev.startMinute + ev.durationMinutes) % 60;
                  const timeString = `${ev.startHour.toString().padStart(2, '0')}:${ev.startMinute.toString().padStart(2, '0')} - ${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
                  const isShort = ev.durationMinutes <= 30;
                  const isGuardia = ev.title === 'GUARDIA';
                  
                  if (isGuardia) {
                    return (
                      <div 
                        key={ev.id}
                        onClick={() => setSelectedAppointment(ev)}
                        className={`absolute left-0 right-0 mx-1 bg-[#FDE68A] border-2 border-[#D97706] rounded-xl cursor-pointer hover:brightness-95 transition-colors shadow-sm z-20 flex items-center justify-center opacity-90`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <span className="font-bold text-[#D97706] tracking-widest text-sm flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">health_and_safety</span>
                          GUARDIA
                        </span>
                      </div>
                    );
                  }
                  
                  return (
                    <div 
                      key={ev.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ev)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedAppointment(ev)}
                      className={`absolute left-1 right-1 ${colors.lightBg} border ${colors.border} rounded-xl ${isShort ? 'py-0.5 px-1.5' : 'p-2'} cursor-pointer hover:brightness-95 transition-colors shadow-sm z-10 flex ${isShort ? 'flex-row items-center justify-between gap-1' : 'flex-col'} overflow-hidden group ${ev.status === 'ausente' ? 'opacity-50 grayscale' : ''}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      {/* Título/Prestación */}
                      {ev.title && ev.title.trim() !== '' && (
                        <div className={`${isShort ? 'hidden' : 'absolute top-1 right-1'} bg-white px-1.5 py-0.5 rounded-full shadow-sm border border-outline-variant/30 text-[9px] font-semibold text-on-surface-variant z-10 flex items-center gap-1`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${colors.bg}`}></span>
                          {ev.title}
                        </div>
                      )}
                      
                      {/* Contenido (Time + Patient) */}
                      <div className={`flex ${isShort ? 'flex-row items-center gap-2 overflow-hidden' : 'flex-col'}`}>
                        <p className={`text-[10px] font-bold ${colors.text} whitespace-nowrap`}>
                          {isShort ? ev.startHour.toString().padStart(2, '0') + ':' + ev.startMinute.toString().padStart(2, '0') : timeString}
                        </p>
                        <div className={`flex items-center gap-1 overflow-hidden ${isShort ? 'w-full' : ''}`}>
                          {isShort && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.bg}`}></span>}
                          <p className={`text-[10px] sm:text-xs font-bold leading-tight ${isShort ? 'truncate' : 'mt-0.5'} ${ev.status === 'ausente' ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                            {ev.patient}
                          </p>
                        </div>
                      </div>
                      
                      {!isShort && (
                        <p className="text-[10px] text-on-surface-variant mt-auto font-medium truncate relative z-0">
                          {ev.professional}
                        </p>
                      )}
                      
                      {/* Attendance Indicator */}
                      {ev.status === 'asistio' && (
                         <div className={`${isShort ? 'relative' : 'absolute bottom-1 right-1'} flex items-center justify-center text-[#10B981] drop-shadow-sm pointer-events-none flex-shrink-0`}>
                           <span className="material-symbols-outlined text-[16px]">check_circle</span>
                         </div>
                      )}
                      {ev.status === 'ausente' && (
                         <div className={`${isShort ? 'relative' : 'absolute bottom-1 right-1'} flex items-center justify-center text-error drop-shadow-sm pointer-events-none flex-shrink-0`}>
                           <span className="material-symbols-outlined text-[16px]">cancel</span>
                         </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Helper para la vista de Día
  const renderDayView = () => {
    const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM a 9 PM (21)
    
    const dayEvents = events.filter(ev => ev.date === format(currentDate, 'yyyy-MM-dd'));

    const weekStartDay = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStartDay, i));

    return (
      <div className="flex flex-col md:h-full w-full bg-surface-container-lowest rounded-3xl border border-outline-variant shadow-sm md:overflow-hidden overflow-visible">
        
        {/* Contenedor scrolleable principal */}
        <div className="flex-1 md:overflow-y-auto relative scroll-smooth" ref={scrollContainerRef}>
          
          {/* Cabecera del día (Semana Horizontal) - STICKY */}
          <div className="sticky top-[80px] md:top-0 z-30 border-b border-outline-variant bg-surface-container-lowest shadow-sm pt-2 pb-3">
            <div className="flex items-center justify-between px-4 pb-2 md:hidden">
              <span className="font-bold text-on-surface capitalize text-sm">{format(currentDate, 'MMMM yyyy', { locale: es })}</span>
              <button 
                onClick={() => setIsMobileFiltersOpen(true)}
                className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center transition-transform active:scale-95 border border-outline-variant/50"
              >
                <span className="material-symbols-outlined text-[18px]">tune</span>
              </button>
            </div>
            <div className="flex items-center justify-between px-2 md:pl-16 overflow-x-auto no-scrollbar gap-1">
              {weekDays.map((day) => {
                const isSelected = isSameDay(day, currentDate);
                const isCurrentToday = isToday(day);
                return (
                  <div 
                    key={day.toString()} 
                    onClick={() => setCurrentDate(day)}
                    className="flex flex-col items-center justify-center cursor-pointer min-w-[12%] md:min-w-0 md:flex-1 gap-1 py-1"
                  >
                    <span className={`text-[10px] font-bold uppercase ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`}>
                      {format(day, 'EEE', { locale: es })}
                    </span>
                    <span className={`text-lg font-medium w-9 h-9 flex items-center justify-center rounded-full transition-all ${
                      isSelected 
                        ? 'bg-primary text-white shadow-md scale-110' 
                        : isCurrentToday 
                          ? 'bg-primary/15 text-primary font-bold' 
                          : 'text-on-surface hover:bg-surface-container-high'
                    }`}>
                      {format(day, 'd')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="relative min-h-[800px] pl-16 w-full">
            {/* Columna de Horas (Fija a la izquierda) */}
            <div className="absolute left-0 top-0 w-16 h-full border-r border-outline-variant flex flex-col z-20 bg-surface-container-lowest pointer-events-none">
              {hours.map(hour => (
                <div key={hour} className="h-20 border-b border-outline-variant/30 flex items-start justify-end p-2 text-xs text-on-surface-variant font-medium bg-surface-container-lowest">
                  {hour}:00
                </div>
              ))}
            </div>
            
            {/* Columna del Día (Única) */}
            <div className="relative w-full h-full">
              {hours.map(hour => (
                <div 
                  key={`day-${hour}`} 
                  className="h-20 border-b border-outline-variant/30 hover:bg-surface-container-low/50 transition-colors cursor-pointer w-full"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, 'day', hour)}
                  onClick={() => {
                    setSelectedTimeForNew(`${hour.toString().padStart(2, '0')}:00`);
                    setIsNewAppointmentModalOpen(true);
                  }}
                >
                </div>
              ))}

              {/* Bloques No Hábiles */}
              {unavailabilities
                .filter(u => u.dayOfWeek === getDay(currentDate))
                .map((u, idx) => {
                  const top = (u.startHour - 6) * 80;
                  const height = (u.endHour - u.startHour) * 80;
                  const prof = professionals.find(p => p.id === u.professional_id);
                  return (
                    <div key={`unav-d-${idx}`} className="absolute left-2 right-4 rounded-xl bg-[repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6_10px,#ffffff_10px,#ffffff_20px)] border border-outline-variant/50 opacity-70 pointer-events-none flex items-center justify-center z-[5]" style={{ top: `${top}px`, height: `${height}px` }}>
                       <span className="bg-surface/90 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-bold text-on-surface-variant shadow-sm border border-outline-variant">
                         Horario No Hábil • {prof?.name}
                       </span>
                    </div>
                  );
                })
              }

              {/* Eventos del día actual */}
              {dayEvents.map(ev => {
                const top = (ev.startHour - 6 + (ev.startMinute || 0) / 60) * 80;
                const height = (ev.durationMinutes / 60) * 80;
                const colors = getEventColor(ev);
                const endH = Math.floor(ev.startHour + (ev.startMinute + ev.durationMinutes) / 60);
                const endM = (ev.startMinute + ev.durationMinutes) % 60;
                const timeString = `${ev.startHour.toString().padStart(2, '0')}:${ev.startMinute.toString().padStart(2, '0')} - ${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
                const isShort = ev.durationMinutes <= 30;
                const isGuardia = ev.title === 'GUARDIA';

                if (isGuardia) {
                  return (
                    <div 
                      key={ev.id}
                      onClick={() => setSelectedAppointment(ev)}
                      className={`absolute left-2 right-4 bg-[#FDE68A] border-2 border-[#D97706] rounded-xl cursor-pointer hover:brightness-95 transition-all shadow-md z-[60] flex items-center justify-center opacity-95`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <span className="font-bold text-[#D97706] tracking-widest text-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-[24px]">health_and_safety</span>
                        GUARDIA - {ev.professional}
                      </span>
                    </div>
                  );
                }
                
                return (
                  <div 
                    key={ev.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, ev)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedAppointment(ev)}
                    className={`absolute left-2 right-4 ${colors.lightBg} border-y border-r border-l-4 ${colors.border} rounded-xl ${isShort ? 'py-1 px-2' : 'p-3'} cursor-pointer hover:brightness-95 transition-all shadow-sm z-[40] flex ${isShort ? 'flex-row items-center justify-between gap-2' : 'flex-col'} overflow-hidden group ${ev.status === 'ausente' ? 'opacity-50 grayscale' : ''}`}
                    style={{ top: `${top}px`, height: `${height}px` }}
                  >
                    {/* Etiqueta de la prestación simulando el Status pill */}
                    {ev.title && ev.title.trim() !== '' && (
                      <div className={`${isShort ? 'hidden' : 'absolute top-2 right-2'} bg-white/80 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm border border-outline-variant/30 text-[10px] font-semibold text-on-surface-variant z-10 flex items-center gap-1.5`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${colors.bg}`}></span>
                        {ev.title}
                      </div>
                    )}
                    
                    <div className={`flex ${isShort ? 'items-center w-full max-w-[80%]' : 'items-start justify-between'} ${isShort ? 'mb-0' : 'mb-1'} relative z-0 overflow-hidden`}>
                      <div className={`flex items-center gap-2 w-full ${isShort ? 'overflow-hidden' : ''}`}>
                        <div className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center ${colors.bg} text-white shadow-sm opacity-90 ${isShort ? 'scale-75 origin-left' : ''}`}>
                          <span className="material-symbols-outlined text-[14px]">
                            {ev.title === 'Ortodoncia' ? 'dentistry' : ev.title === 'Implantes' ? 'medical_services' : 'person'}
                          </span>
                        </div>
                        <div className={`flex ${isShort ? 'flex-row items-center gap-2 overflow-hidden w-full' : 'flex-col pt-0.5'}`}>
                          <span className={`text-sm font-bold block leading-tight truncate ${isShort ? 'flex-shrink' : 'max-w-[150px]'} ${ev.status === 'ausente' ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                            {ev.patient}
                          </span>
                          
                          {/* Compact details for 30min */}
                          {isShort && (
                            <span className={`text-[10px] font-bold ${colors.text} bg-white/50 px-1.5 rounded flex-shrink-0 flex items-center gap-1`}>
                              <span className={`w-1 h-1 rounded-full ${colors.bg}`}></span>
                              {ev.title}
                            </span>
                          )}

                          <span className={`text-[10px] font-bold ${colors.text} opacity-80 flex-shrink-0 ${isShort ? 'hidden' : 'flex items-center gap-1'}`}>
                            {timeString}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Hover actions and Professional Name - Hidden if short */}
                    {!isShort && (
                      <div className="mt-auto flex justify-between items-end opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                         <span className="bg-white/60 text-[10px] font-bold px-2 py-0.5 rounded text-on-surface-variant truncate max-w-[120px] shadow-sm">
                           {ev.professional}
                         </span>
                         <div className="flex gap-1.5 relative z-20 mr-8">
                           <Link href={`/patients/${ev.patient_id}`} className="w-7 h-7 bg-white hover:bg-primary hover:text-white rounded-full flex items-center justify-center transition-colors shadow-sm border border-outline-variant/30 text-on-surface-variant" title="Ver Paciente">
                              <span className="material-symbols-outlined text-[14px]">person</span>
                           </Link>
                           <button onClick={(e) => { e.stopPropagation(); setSelectedAppointment(ev); }} className="w-7 h-7 bg-white hover:bg-primary hover:text-white rounded-full flex items-center justify-center transition-colors shadow-sm border border-outline-variant/30 text-on-surface-variant" title="Gestionar Turno">
                              <span className="material-symbols-outlined text-[14px]">edit</span>
                           </button>
                         </div>
                      </div>
                    )}
                    
                    {/* Attendance Indicator */}
                    {ev.status === 'asistio' && (
                       <div className={`${isShort ? 'relative' : 'absolute bottom-2 right-3'} flex items-center justify-center text-[#10B981] z-10 transition-opacity pointer-events-none drop-shadow-sm flex-shrink-0`}>
                         <span className="material-symbols-outlined text-[18px]">check_circle</span>
                       </div>
                    )}
                    {ev.status === 'ausente' && (
                       <div className={`${isShort ? 'relative' : 'absolute bottom-2 right-3'} flex items-center justify-center text-error z-10 transition-opacity pointer-events-none drop-shadow-sm flex-shrink-0`}>
                         <span className="material-symbols-outlined text-[18px]">cancel</span>
                       </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Helper para la vista de Mes
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";
    
    const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;
        const isCurrentMonth = isSameMonth(day, monthStart);
        const dayEvents = events.filter(ev => ev.date === format(day, 'yyyy-MM-dd'));
        
        days.push(
          <div
            key={day.toString()}
            className={`min-h-[140px] p-2 border-r border-b border-outline-variant/30 flex flex-col transition-colors cursor-pointer ${
              !isCurrentMonth ? "bg-surface-container-lowest/50" : "hover:bg-surface-container-low/30"
            }`}
            onClick={() => {
              setCurrentDate(cloneDay);
              setView('day'); // Al hacer clic en un día del mes, vamos a la vista de día
            }}
          >
            <div className="flex justify-end mb-1">
              <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                !isCurrentMonth ? "text-on-surface-variant/40" : isSameDay(day, new Date()) ? "bg-primary text-on-primary" : "text-on-surface"
              }`}>
                {formattedDate}
              </span>
            </div>
            {/* Indicadores de eventos de prueba para el mes */}
            <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
              {dayEvents.map(ev => {
                const colors = getEventColor(ev);
                const timeString = `${ev.startHour.toString().padStart(2, '0')}:${(ev.startMinute || 0).toString().padStart(2, '0')}`;
                return (
                  <div key={ev.id} className={`w-full ${colors.bg} text-white text-[10px] font-bold px-1.5 py-0.5 rounded truncate shadow-sm ${ev.status === 'ausente' ? 'opacity-60 line-through' : ''}`} title={`${timeString} - ${ev.patient} (${ev.professional})`}>
                    {ev.status === 'asistio' && <span className="material-symbols-outlined text-[10px] mr-1 align-middle">check_circle</span>}
                    {ev.status === 'ausente' && <span className="material-symbols-outlined text-[10px] mr-1 align-middle">cancel</span>}
                    {timeString} {ev.patient}
                  </div>
                );
              })}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7 flex-1" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div className="flex flex-col md:h-full w-full bg-surface-container-lowest rounded-3xl border border-outline-variant shadow-sm md:overflow-hidden overflow-visible">
        <div className="grid grid-cols-7 border-b border-outline-variant">
          {weekDays.map((d) => (
            <div key={d} className="p-3 text-center border-r border-outline-variant/30 last:border-0">
              <span className="text-xs font-bold uppercase text-on-surface-variant">{d}</span>
            </div>
          ))}
        </div>
        <div className="flex-1 flex flex-col">
          {rows}
        </div>
      </div>
    );
  };

  const renderSidebarTop = () => (
    <div className="flex flex-col gap-3">
      {/* Controles */}
      <div className="flex flex-col gap-2">
        <button 
          onClick={() => setIsNewAppointmentModalOpen(true)}
          className="bg-primary text-on-primary w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 transition-all active:scale-95 font-bold text-sm"
        >
          <span className="material-symbols-outlined text-[20px]">calendar_add_on</span>
          Agendar Nuevo Turno
        </button>
      </div>

      {/* Mini Calendario */}
      {renderMiniCalendar()}
    </div>
  );

  const renderSidebarContent = () => (
    <>
        {/* Filtros de Profesionales */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-label-lg text-label-lg font-bold text-on-surface-variant flex items-center gap-1 cursor-pointer select-none" onClick={() => setIsProfessionalsExpanded(!isProfessionalsExpanded)}>
              Profesionales
              <span className="material-symbols-outlined text-[18px]">{isProfessionalsExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>
            </h3>
          </div>

          {isProfessionalsExpanded && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              {professionals.map((prof) => (
                <label key={prof.id} className="flex items-center gap-3 px-2 py-1.5 hover:bg-surface-container-low rounded-lg cursor-pointer transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded text-primary border-outline focus:ring-primary" defaultChecked />
                  <span className="font-body-sm text-sm text-on-surface">{prof.name}</span>
                </label>
              ))}
              {professionals.length === 0 && (
                <div className="text-xs text-on-surface-variant px-2">Cargando profesionales...</div>
              )}
            </div>
          )}
        </div>

        {/* Categorías de Prestación */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-label-lg text-label-lg font-bold text-on-surface-variant flex items-center gap-1 cursor-pointer select-none" onClick={() => setIsServicesExpanded(!isServicesExpanded)}>
              Prestaciones
              <span className="material-symbols-outlined text-[18px]">{isServicesExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>
            </h3>
            <button 
              onClick={() => setIsServicesConfigOpen(true)}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-colors shadow-sm bg-surface-container hover:bg-surface-container-high text-on-surface-variant"
              title="Configurar Prestaciones"
            >
              <span className="material-symbols-outlined text-[14px]">settings</span>
            </button>
          </div>
          
          {isServicesExpanded && (
            <div className="space-y-2 mb-3 animate-in fade-in slide-in-from-top-2">
              {services.map((srv) => (
                <div key={srv.name} className="flex items-center justify-between group px-2 py-1 hover:bg-surface-container-low rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${srv.color}`}></div>
                    <span className="font-body-sm text-sm text-on-surface">{srv.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Horarios No Hábiles */}
        <div className="mt-2 border-t border-outline-variant/50 pt-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-label-lg text-[13px] font-bold text-on-surface-variant flex items-center gap-1 cursor-pointer select-none" onClick={() => setIsAvailabilityModalOpen(!isAvailabilityModalOpen)}>
              Configurar horarios (no hábiles)
              <span className="material-symbols-outlined text-[18px]">{isAvailabilityModalOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>
            </h3>
          </div>

          {isAvailabilityModalOpen && (
            <div className="mb-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-3 shadow-sm animate-in fade-in slide-in-from-top-2">
              <h4 className="text-xs font-bold text-on-surface mb-2">Bloqueos actuales</h4>
              
              <div className="space-y-2 max-h-32 overflow-y-auto mb-3">
                {unavailabilities.length === 0 ? (
                  <p className="text-[10px] text-on-surface-variant text-center py-2">Sin horarios bloqueados</p>
                ) : (
                  unavailabilities.map((u, i) => {
                    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                    return (
                      <div key={i} className="flex items-center justify-between bg-surface p-1.5 rounded border border-outline-variant shadow-sm text-[10px]">
                        <span className="font-semibold">{days[u.dayOfWeek]}: {u.startHour}:00 - {u.endHour}:00</span>
                        <button 
                          onClick={() => {
                            const updated = unavailabilities.filter((_, idx) => idx !== i);
                            setUnavailabilities(updated);
                            localStorage.setItem('clinic_unavailabilities', JSON.stringify(updated));
                          }}
                          className="text-error hover:bg-error/10 w-5 h-5 rounded-full flex items-center justify-center"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const day = parseInt((form.elements.namedItem('day') as HTMLSelectElement).value);
                const start = parseInt((form.elements.namedItem('start') as HTMLSelectElement).value);
                const end = parseInt((form.elements.namedItem('end') as HTMLSelectElement).value);
                
                if (start >= end) {
                  alert("Inicio debe ser menor a fin");
                  return;
                }
                
                const updated = [...unavailabilities, { professional_id: '1', dayOfWeek: day, startHour: start, endHour: end }];
                setUnavailabilities(updated);
                localStorage.setItem('clinic_unavailabilities', JSON.stringify(updated));
              }} className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant mb-0.5">Día</label>
                    <select name="day" className="w-full bg-surface border border-outline-variant rounded-md py-1 px-1 text-[10px]">
                      <option value="1">Lun</option><option value="2">Mar</option><option value="3">Mié</option>
                      <option value="4">Jue</option><option value="5">Vie</option><option value="6">Sáb</option><option value="0">Dom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-on-surface-variant mb-0.5">Inicio - Fin</label>
                    <div className="flex items-center gap-1">
                      <select name="start" className="w-full bg-surface border border-outline-variant rounded-md py-1 px-0.5 text-[10px]">
                        {Array.from({length: 15}, (_, i) => i + 6).map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <span className="text-[10px]">-</span>
                      <select name="end" className="w-full bg-surface border border-outline-variant rounded-md py-1 px-0.5 text-[10px]" defaultValue="14">
                        {Array.from({length: 15}, (_, i) => i + 7).map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <button type="submit" className="bg-primary text-white w-full py-1.5 rounded-md flex items-center justify-center hover:bg-primary/90 shadow-sm text-[10px] font-bold">
                  Agregar Bloqueo
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Guardias */}
        <div className="mt-2 border-t border-outline-variant/50 pt-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-label-lg text-[13px] font-bold text-on-surface-variant flex items-center gap-1 cursor-pointer select-none" onClick={() => setIsGuardiasModalOpen(!isGuardiasModalOpen)}>
              Configurar Guardias
              <span className="material-symbols-outlined text-[18px]">{isGuardiasModalOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>
            </h3>
          </div>

          {isGuardiasModalOpen && (
            <div className="mb-4 bg-[#FDE68A]/30 border border-[#F59E0B]/50 rounded-xl p-3 shadow-sm animate-in fade-in slide-in-from-top-2">
              <h4 className="text-xs font-bold text-[#D97706] mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">health_and_safety</span> Guardias
              </h4>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const date = (form.elements.namedItem('date') as HTMLInputElement).value;
                const start = (form.elements.namedItem('start') as HTMLInputElement).value;
                const end = (form.elements.namedItem('end') as HTMLInputElement).value;
                const profId = (form.elements.namedItem('prof') as HTMLSelectElement).value;
                
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const startHour = parseInt(start.split(':')[0]);
                const endHour = parseInt(end.split(':')[0]);
                
                const isOvernight = startHour > endHour || (startHour === endHour && parseInt(start.split(':')[1]) >= parseInt(end.split(':')[1]));

                // Handle patient_id required constraint by creating/finding a generic GUARDIA patient
                let guardiaPatientId = null;
                const { data: existingPatient } = await supabase.from('patients').select('id').eq('first_name', 'GUARDIA').limit(1).maybeSingle();
                
                if (existingPatient) {
                  guardiaPatientId = existingPatient.id;
                } else {
                  const { data: newPatient, error: newPatientError } = await supabase.from('patients').insert({
                    first_name: 'GUARDIA',
                    last_name: 'INTERNA',
                    phone: '00000000',
                    user_id: user.id
                  }).select('id').single();
                  
                  if (!newPatientError && newPatient) {
                    guardiaPatientId = newPatient.id;
                  }
                }

                let inserts = [];

                if (isOvernight) {
                  // Guardia cruzando la medianoche (madrugada)
                  inserts.push({
                    user_id: user.id,
                    professional_id: profId,
                    patient_id: guardiaPatientId,
                    date: date,
                    start_time: `${start}:00`,
                    end_time: `23:59:00`,
                    service_type: 'GUARDIA',
                    status: 'Scheduled'
                  });
                  
                  const parts = date.split('-');
                  const nextDay = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
                  nextDay.setDate(nextDay.getDate() + 1);
                  const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth()+1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
                  
                  inserts.push({
                    user_id: user.id,
                    professional_id: profId,
                    patient_id: guardiaPatientId,
                    date: nextDayStr,
                    start_time: `00:00:00`,
                    end_time: `${end}:00`,
                    service_type: 'GUARDIA',
                    status: 'Scheduled'
                  });
                } else {
                  inserts.push({
                    user_id: user.id,
                    professional_id: profId,
                    patient_id: guardiaPatientId,
                    date: date,
                    start_time: `${start}:00`,
                    end_time: `${end}:00`,
                    service_type: 'GUARDIA',
                    status: 'Scheduled'
                  });
                }

                const { error } = await supabase.from('appointments').insert(inserts);

                if (error) {
                  showAlert("Error al guardar guardia: " + error.message, "Error");
                } else {
                  showToast("Guardia registrada exitosamente", "success");
                  form.reset();
                  fetchCalendarData();
                }
              }} className="flex flex-col gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-[#D97706] mb-0.5">Profesional</label>
                  <select name="prof" className="w-full bg-surface border border-[#F59E0B]/30 rounded-md py-1 px-1 text-[10px]" required>
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-[#D97706] mb-0.5">Fecha</label>
                  <input type="date" name="date" required className="w-full bg-surface border border-[#F59E0B]/30 rounded-md py-1 px-1 text-[10px]" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-[#D97706] mb-0.5">Inicio - Fin</label>
                  <div className="flex items-center gap-1">
                    <input type="time" name="start" required defaultValue="17:00" className="w-full bg-surface border border-[#F59E0B]/30 rounded-md py-1 px-1 text-[10px]" />
                    <span className="text-[10px] text-[#D97706]">-</span>
                    <input type="time" name="end" required defaultValue="08:00" className="w-full bg-surface border border-[#F59E0B]/30 rounded-md py-1 px-1 text-[10px]" />
                  </div>
                  <p className="text-[8px] text-[#D97706]/70 mt-0.5">*Si cruza la medianoche se dividirá automáticamente en dos días.</p>
                </div>
                <button type="submit" className="mt-1 bg-[#F59E0B] text-white w-full py-1.5 rounded-md flex items-center justify-center hover:bg-[#D97706] shadow-sm text-[10px] font-bold">
                  Registrar Guardia
                </button>
              </form>
            </div>
          )}
        </div>
    </>
  );

  return (
    <>
      <div className="min-h-[calc(100vh-160px)] md:h-screen w-full flex flex-col md:flex-row bg-surface overflow-visible md:overflow-hidden animate-in fade-in duration-150">
      
      {/* Sidebar Izquierdo de la Agenda */}
      <div className="hidden md:flex w-72 bg-surface-container-lowest border-r border-outline-variant flex-col p-4 gap-6 overflow-y-auto">
        <div className="flex bg-surface-container-low p-1 rounded-xl shadow-sm border border-outline-variant">
          <button 
            onClick={() => setView('day')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${view === 'day' ? 'bg-surface shadow text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Día
          </button>
          <button 
            onClick={() => setView('week')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${view === 'week' ? 'bg-surface shadow text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Semana
          </button>
          <button 
            onClick={() => setView('month')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${view === 'month' ? 'bg-surface shadow text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Mes
          </button>
        </div>
        {renderSidebarTop()}
        {renderSidebarContent()}
      </div>

      {/* Área Principal del Calendario */}
      <div className="flex-1 flex flex-col bg-surface overflow-visible md:overflow-hidden relative">
        
        {/* Fondo de color suave degradado tipo screenshot */}
        <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-primary-container/30 to-transparent pointer-events-none"></div>

        {/* Banner de Próximo Paciente */}
        {nextEvent && (
          <div className="mx-6 mt-6 mb-2 bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between shadow-sm relative z-10 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-sm">
                <span className="material-symbols-outlined text-[20px]">notifications_active</span>
              </div>
              <div>
                <p className="text-sm font-bold text-primary mb-0.5">Recordatorio: Próximo Turno a las {nextEvent.startHour}:00</p>
                <p className="text-sm font-medium text-on-surface">Paciente: <strong className="font-bold">{nextEvent.patient}</strong> • {nextEvent.title}</p>
              </div>
            </div>
            <button onClick={() => setSelectedAppointment(nextEvent)} className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl shadow-sm hover:bg-primary/90 transition-colors">
              Ver Detalles
            </button>
          </div>
        )}

        {/* Elementos superiores en móvil (Botón y Mini-calendario) */}
        <div className="md:hidden px-6 pt-4 flex flex-col gap-4 relative z-10 animate-in fade-in slide-in-from-top-4">
          {renderSidebarTop()}
        </div>

        {/* Header Principal (Oculto en Móvil según preferencia del usuario) */}
        <div className={`hidden md:flex px-6 items-center relative z-10 ${nextEvent ? 'h-16' : 'h-20 mt-4'}`}>
          <div className="flex items-center gap-4">
            <h2 className="font-display-sm text-display-sm capitalize text-on-surface">
              {format(currentDate, 'MMMM yyyy', { locale: es })}
            </h2>
            <button onClick={goToToday} className="px-3 py-1 bg-surface-container-high rounded-full text-xs font-bold hover:bg-primary-container transition-colors">
              Hoy
            </button>
            <div className="flex gap-1 ml-2">
              <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 relative z-10 overflow-visible md:overflow-hidden flex flex-col">
          {view === 'week' && renderWeekView()}
          {view === 'day' && renderDayView()}
          {view === 'month' && renderMonthView()}

          {/* Mobile FABs */}
          <div className="md:hidden fixed bottom-24 right-6 flex flex-col gap-3 z-50">
            <button 
              onClick={() => setIsNewAppointmentModalOpen(true)}
              className="w-14 h-14 rounded-full bg-primary text-on-primary shadow-lg flex items-center justify-center transition-transform active:scale-95"
              title="Agendar Nuevo Turno"
            >
              <span className="material-symbols-outlined text-[28px]">add</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Mobile Filters Drawer */}
    {isMobileFiltersOpen && (
      <Portal>
        <div className="fixed inset-0 z-[100] flex md:hidden">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsMobileFiltersOpen(false)}
          ></div>
          <div className="w-[85vw] h-full bg-surface-container-lowest shadow-2xl relative z-10 animate-in slide-in-from-left duration-300 flex flex-col overflow-y-auto">
            <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between sticky top-0 bg-surface-container-lowest z-20">
              <h2 className="font-title-md text-lg font-bold text-on-surface">Opciones</h2>
              <button 
                onClick={() => setIsMobileFiltersOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-4 flex flex-col gap-6">
              {renderSidebarContent()}
            </div>
          </div>
        </div>
      </Portal>
    )}

    {/* Modal de Configuración de Prestaciones */}
    <ServicesConfigModal 
      isOpen={isServicesConfigOpen} 
      onClose={() => setIsServicesConfigOpen(false)} 
      services={services}
      onSuccess={fetchServices}
      onOptimisticUpdate={setServices}
    />

      {/* Modal de Detalle de Cita */}
      {selectedAppointment && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 px-4">
          <div className="bg-surface w-full max-w-[420px] rounded-[2rem] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedAppointment(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            
            <div className="flex items-center gap-3 mb-4 pr-10">
              <div className={`w-3 h-10 rounded-full ${selectedAppointment.color}`}></div>
              <div>
                <h2 className="font-title-md text-xl font-bold text-on-surface leading-tight">{selectedAppointment.title}</h2>
                <p className="text-sm font-medium text-on-surface-variant">{selectedAppointment.type}</p>
              </div>
            </div>

            <div className="space-y-4 bg-surface-container-lowest border border-outline-variant/50 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">schedule</span>
                <span className="font-medium text-sm">{format(currentDate, 'dd/MM/yyyy')} • {selectedAppointment.start_time?.slice(0, 5) || "00:00"} - {selectedAppointment.end_time?.slice(0, 5) || "00:00"}</span>
              </div>
              <div className="flex items-center gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">person</span>
                <span className="font-medium text-sm">Paciente: <strong className="text-on-surface">{selectedAppointment.patient}</strong></span>
              </div>
              <div className="flex items-center gap-3 text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">stethoscope</span>
                <span className="font-medium text-sm">Profesional: {selectedAppointment.professional}</span>
              </div>
            </div>

            {selectedAppointment.title !== 'GUARDIA' && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button type="button" onClick={() => handleAttendance('asistio')} className="py-2.5 px-4 rounded-xl font-label-sm text-sm bg-[#34D399]/20 text-[#10B981] hover:bg-[#34D399]/30 transition-colors border border-[#34D399]/30 flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span> Asistió
                </button>
                <button type="button" onClick={() => handleAttendance('ausente')} className="py-2.5 px-4 rounded-xl font-label-sm text-sm bg-error/10 text-error hover:bg-error/20 transition-colors border border-error/20 flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">cancel</span> Ausente
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setAppointmentToEdit(selectedAppointment);
                  setSelectedAppointment(null);
                }}
                className="flex-1 py-3 px-2 rounded-xl font-label-sm text-xs bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors flex flex-col items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[20px]">edit</span> Editar
              </button>
              <button 
                onClick={() => {
                  setAlertDialog({
                    isOpen: true,
                    title: selectedAppointment.title === 'GUARDIA' ? 'Borrar Guardia' : 'Borrar Turno',
                    message: selectedAppointment.title === 'GUARDIA' ? '¿Estás seguro de que deseas eliminar esta guardia?' : '¿Estás seguro de que deseas eliminar este turno?',
                    type: 'confirm',
                    confirmText: 'Borrar',
                    onConfirm: async () => {
                      // Optimistic delete
                      setEvents(events.filter(e => e.id !== selectedAppointment.id));
                      setAlertDialog(prev => ({ ...prev, isOpen: false }));
                      setSelectedAppointment(null);
                      
                      const { error } = await supabase.from('appointments').delete().eq('id', selectedAppointment.id);
                      if (error) {
                        fetchCalendarData(); // Revert on failure
                        showAlert('Error al borrar de la BD: ' + error.message);
                      }
                    }
                  });
                }}
                className="flex-1 py-3 px-2 rounded-xl font-label-sm text-xs bg-error/10 hover:bg-error/20 text-error transition-colors flex flex-col items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[20px]">delete</span> Borrar
              </button>
              {selectedAppointment.title !== 'GUARDIA' && (
                <Link 
                  href={`/patients/${selectedAppointment.patient_id}`}
                  className="flex-[2] py-3 px-4 rounded-xl font-label-sm text-sm bg-primary hover:bg-primary/90 text-on-primary transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">medical_information</span> Historia Clínica
                </Link>
              )}
            </div>
          </div>
        </div>
        </Portal>
      )}

      <NewAppointmentModal 
        isOpen={isNewAppointmentModalOpen || !!appointmentToEdit}
        appointmentToEdit={appointmentToEdit}
        initialTime={selectedTimeForNew}
        services={services}
        onClose={() => {
          setIsNewAppointmentModalOpen(false);
          setAppointmentToEdit(null);
          setSelectedTimeForNew(undefined);
        }}
        onSuccess={() => {
          setIsNewAppointmentModalOpen(false);
          setAppointmentToEdit(null);
          setSelectedTimeForNew(undefined);
          fetchCalendarData();
          showToast('Turno guardado exitosamente.', 'success');
        }}
      />

      <AlertDialog 
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
        onConfirm={alertDialog.onConfirm}
        onCancel={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
        confirmText={alertDialog.confirmText}
      />
      
      {/* Toast Notification */}
      {toast.visible && (
        <Portal>
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 fade-in duration-300">
            <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl border ${toast.type === 'success' ? 'bg-[#10B981]/10 border-[#10B981]/20 text-emerald-900' : 'bg-error/10 border-error/20 text-error-900'} backdrop-blur-md`}>
              <span className={`material-symbols-outlined ${toast.type === 'success' ? 'text-[#10B981]' : 'text-error'}`}>
                {toast.type === 'success' ? 'check_circle' : 'error'}
              </span>
              <span className="font-bold text-sm">{toast.message}</span>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
