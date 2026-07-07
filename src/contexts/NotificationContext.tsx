"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export interface Notification {
  id: string;
  type: 'appointment' | 'payment_alert';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  requestPermission: () => Promise<void>;
  permissionGranted: boolean;
  preferences: {
    appointmentMinutes: number;
    paymentReport: 'none' | 'daily' | 'weekly';
  };
  updatePreferences: (prefs: Partial<NotificationContextType['preferences']>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [preferences, setPreferences] = useState({
    appointmentMinutes: 15,
    paymentReport: 'daily' as 'none' | 'daily' | 'weekly'
  });
  const [toast, setToast] = useState<Notification | null>(null);
  
  const supabase = createClient();
  const router = useRouter();

  // Load preferences and notifications from local storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPermissionGranted(Notification.permission === 'granted');
      
      const storedPrefs = localStorage.getItem('bina_notification_prefs');
      if (storedPrefs) setPreferences(JSON.parse(storedPrefs));

      const storedNotifs = localStorage.getItem('bina_notifications');
      if (storedNotifs) setNotifications(JSON.parse(storedNotifs));
    }
  }, []);

  const updatePreferences = (prefs: Partial<NotificationContextType['preferences']>) => {
    const newPrefs = { ...preferences, ...prefs };
    setPreferences(newPrefs);
    localStorage.setItem('bina_notification_prefs', JSON.stringify(newPrefs));
  };

  const requestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setPermissionGranted(permission === 'granted');
    }
  };

  const addNotification = (notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: Notification = {
      ...notif,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      read: false
    };

    setNotifications(prev => {
      // Avoid duplicate alerts (e.g. same appointment in a short time)
      if (prev.some(p => p.title === newNotif.title && !p.read)) return prev;
      
      const updated = [newNotif, ...prev];
      localStorage.setItem('bina_notifications', JSON.stringify(updated.slice(0, 50))); // keep last 50
      return updated;
    });

    // Show native push if allowed
    if (permissionGranted) {
      new window.Notification(newNotif.title, {
        body: newNotif.message,
        icon: '/images/logo_b.png'
      });
    }

    // Show in-app toast
    setToast(newNotif);
    setTimeout(() => setToast(null), 6000);
  };

  // -------------------------
  // WORKER: Check Appointments
  // -------------------------
  useEffect(() => {
    if (preferences.appointmentMinutes === 0) return;

    const checkAppointments = async () => {
      try {
        const { data: appointments } = await supabase
          .from('appointments')
          .select('*, patient:patients(first_name, last_name, id)')
          .gte('date', new Date().toISOString());

        if (!appointments) return;

        const now = new Date();
        
        appointments.forEach(app => {
          const appTime = new Date(app.date);
          const diffMs = appTime.getTime() - now.getTime();
          const diffMinutes = Math.floor(diffMs / 60000);

          // If the appointment is happening in exactly X minutes (allow a 1 min window)
          if (diffMinutes === preferences.appointmentMinutes || diffMinutes === preferences.appointmentMinutes - 1) {
            addNotification({
              type: 'appointment',
              title: `Próximo Turno: ${app.patient?.first_name || ''} ${app.patient?.last_name || ''}`,
              message: `Turno en ${preferences.appointmentMinutes} minutos a las ${appTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
              actionUrl: `/patients/${app.patient_id}`
            });
          }
        });
      } catch (e) {
        console.error(e);
      }
    };

    checkAppointments(); // Initial check
    const interval = setInterval(checkAppointments, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [preferences.appointmentMinutes, permissionGranted]);

  // -------------------------
  // WORKER: Check Pending Payments
  // -------------------------
  useEffect(() => {
    if (preferences.paymentReport === 'none') return;

    const checkPayments = async () => {
      // Logic to check only once a day
      const lastCheck = localStorage.getItem('bina_last_payment_check');
      const today = new Date().toDateString();
      if (lastCheck === today) return;

      try {
        const { data: bills } = await supabase
          .from('bills')
          .select('*, payments:bill_payments(amount), patient:patients(first_name, last_name)');

        if (!bills) return;

        let debtorsCount = 0;
        let totalDebt = 0;

        const debtorSet = new Set();

        bills.forEach(bill => {
          const totalPaid = bill.payments.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
          const balance = Number(bill.total_amount) - totalPaid;
          if (balance > 0) {
            debtorSet.add(bill.patient_id);
            totalDebt += balance;
          }
        });

        debtorsCount = debtorSet.size;

        if (debtorsCount > 0) {
          addNotification({
            type: 'payment_alert',
            title: 'Reporte: Pacientes con deudas',
            message: `Hay ${debtorsCount} paciente(s) con saldos pendientes por un total de $${totalDebt.toLocaleString('es-AR')}.`,
            actionUrl: `/finance`
          });
        }
        
        localStorage.setItem('bina_last_payment_check', today);
      } catch (e) {
        console.error(e);
      }
    };

    // Run a few seconds after load
    const timeout = setTimeout(checkPayments, 10000);
    return () => clearTimeout(timeout);
  }, [preferences.paymentReport]);

  const markAsRead = (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      localStorage.setItem('bina_notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('bina_notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const clearAll = () => {
    setNotifications([]);
    localStorage.removeItem('bina_notifications');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, markAsRead, markAllAsRead, clearAll,
      requestPermission, permissionGranted, preferences, updatePreferences
    }}>
      {children}
      
      {/* Toast UI */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div 
            onClick={() => {
              if (toast.actionUrl) router.push(toast.actionUrl);
              setToast(null);
            }}
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-[0px_10px_30px_rgba(146,130,113,0.15)] p-4 flex gap-4 w-80 cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${toast.type === 'appointment' ? 'bg-primary-container text-primary' : 'bg-red-100 text-red-600'}`}>
              <span className="material-symbols-outlined">
                {toast.type === 'appointment' ? 'calendar_clock' : 'account_balance_wallet'}
              </span>
            </div>
            <div className="flex flex-col flex-1">
              <h4 className="text-sm font-bold text-on-surface mb-1 leading-tight">{toast.title}</h4>
              <p className="text-xs text-on-surface-variant leading-snug">{toast.message}</p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setToast(null); }}
              className="text-on-surface-variant hover:text-error h-fit"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
