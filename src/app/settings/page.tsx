"use client";
import { useState, useEffect } from "react";

import { useNotifications } from "@/contexts/NotificationContext";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { preferences, updatePreferences, requestPermission, permissionGranted } = useNotifications();
  const supabase = createClient();
  const router = useRouter();

  const [bankDetails, setBankDetails] = useState({
    beneficiary: "",
    bank: "",
    cbu: "",
    alias: "",
    cuit: ""
  });
  const [isSavingBank, setIsSavingBank] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('clinic_settings').select('value').eq('key', 'bank_details').single();
      if (data && data.value) {
        setBankDetails(data.value as any);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveBank = async () => {
    setIsSavingBank(true);
    try {
      const { error } = await supabase.from('clinic_settings').upsert({
        key: 'bank_details',
        value: bankDetails
      });
      if (error) throw error;
      alert("Datos guardados con éxito.");
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh(); // Force refresh to clear server-side session state
  };

  return (
    <div className="px-margin-mobile md:px-margin-desktop pb-xl">
      {/* Header Section */}
      <section className="py-lg flex flex-col md:flex-row md:items-center justify-between gap-md">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-xs">Configuración</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Administra las integraciones y el estado del sistema.</p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
        <section className="bg-surface-container-lowest p-lg rounded-xl border border-tertiary-fixed shadow-[0px_10px_30px_rgba(146,130,113,0.08)] flex flex-col transition-opacity">
          <div className="flex items-start justify-between mb-md">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${permissionGranted ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-surface-container-high text-on-surface-variant'}`}>
              <span className="material-symbols-outlined text-[24px]">notifications_active</span>
            </div>
            <span className={`px-sm py-xs rounded-full text-label-sm font-label-sm flex items-center gap-1 ${permissionGranted ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {permissionGranted ? 'Activado' : 'Requiere Permiso'}
            </span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">Notificaciones Nativas</h3>
          <p className="font-body-md text-body-md text-on-surface-variant mb-lg flex-1">
            Recibe alertas emergentes sobre turnos y reportes de saldos pendientes, incluso minimizando la app.
          </p>

          <div className="space-y-4 mb-4">
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Aviso de Turno Próximo</label>
              <select 
                className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm focus:border-primary outline-none"
                value={preferences.appointmentMinutes}
                onChange={e => updatePreferences({ appointmentMinutes: Number(e.target.value) })}
              >
                <option value={0}>Desactivado</option>
                <option value={15}>15 minutos antes</option>
                <option value={30}>30 minutos antes</option>
                <option value={60}>1 hora antes</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Reporte Deudores</label>
              <select 
                className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm focus:border-primary outline-none"
                value={preferences.paymentReport}
                onChange={e => updatePreferences({ paymentReport: e.target.value as 'none' | 'daily' | 'weekly' })}
              >
                <option value="none">Desactivado</option>
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>
          </div>

          <div className="mt-auto pt-md border-t border-tertiary-fixed flex items-center justify-between">
            {!permissionGranted && (
              <button 
                onClick={requestPermission}
                className="w-full py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg font-bold text-sm transition-colors mb-2"
              >
                Otorgar Permiso al Navegador
              </button>
            )}
            <button 
              onClick={() => {
                if (permissionGranted) {
                  new window.Notification("¡Sistema Funcional!", {
                    body: "Las notificaciones nativas están funcionando correctamente.",
                    icon: '/images/logo_b.png'
                  });
                } else {
                  alert("Primero debes otorgar permisos al navegador.");
                }
              }}
              className="w-full py-2 bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-lg font-bold text-sm transition-colors"
            >
              Probar Notificación
            </button>
          </div>
        </section>

        {/* Datos Bancarios Card */}
        <section className="bg-surface-container-lowest p-lg rounded-xl border border-tertiary-fixed shadow-[0px_10px_30px_rgba(146,130,113,0.08)] flex flex-col transition-opacity">
          <div className="flex items-start justify-between mb-md">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">account_balance</span>
            </div>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">Datos Bancarios</h3>
          <p className="font-body-md text-body-md text-on-surface-variant mb-lg flex-1">
            Configura los datos que aparecerán en los presupuestos y recibos PDF para los pagos de tus pacientes.
          </p>

          <div className="space-y-4 mb-4">
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Titular de la Cuenta</label>
              <input 
                type="text" 
                value={bankDetails.beneficiary}
                onChange={e => setBankDetails({...bankDetails, beneficiary: e.target.value})}
                className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm focus:border-primary outline-none"
                placeholder="Ej. Clínica Dental S.A."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Banco</label>
                <input 
                  type="text" 
                  value={bankDetails.bank}
                  onChange={e => setBankDetails({...bankDetails, bank: e.target.value})}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm focus:border-primary outline-none"
                  placeholder="Ej. Banco Macro"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">CUIT / CUIL</label>
                <input 
                  type="text" 
                  value={bankDetails.cuit}
                  onChange={e => setBankDetails({...bankDetails, cuit: e.target.value})}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm focus:border-primary outline-none"
                  placeholder="Ej. 30-12345678-9"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">CBU / CVU</label>
              <input 
                type="text" 
                value={bankDetails.cbu}
                onChange={e => setBankDetails({...bankDetails, cbu: e.target.value})}
                className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm focus:border-primary outline-none"
                placeholder="0000000000000000000000"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">Alias</label>
              <input 
                type="text" 
                value={bankDetails.alias}
                onChange={e => setBankDetails({...bankDetails, alias: e.target.value})}
                className="w-full bg-surface border border-outline-variant rounded-lg p-2 text-sm focus:border-primary outline-none"
                placeholder="clinica.dental.alias"
              />
            </div>
          </div>

          <div className="mt-auto pt-md border-t border-tertiary-fixed">
            <button 
              onClick={handleSaveBank}
              disabled={isSavingBank}
              className="w-full py-2 bg-primary text-white hover:bg-primary/90 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSavingBank ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : 'Guardar Datos'}
            </button>
          </div>
        </section>

        {/* Cierre de Sesión Card */}
        <section className="bg-error/5 p-lg rounded-xl border border-error/20 shadow-sm flex flex-col">
          <div className="flex items-start justify-between mb-md">
            <div className="w-12 h-12 bg-error/10 text-error rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">logout</span>
            </div>
          </div>
          <h3 className="font-headline-md text-headline-md text-error mb-xs">Cerrar Sesión</h3>
          <p className="font-body-md text-body-md text-on-surface-variant mb-lg flex-1">
            Cierra la sesión actual y vuelve a la pantalla de inicio de sesión.
          </p>
          <div className="mt-auto pt-md border-t border-error/20">
            <button 
              onClick={handleLogout}
              className="w-full py-2 bg-error text-white rounded-lg font-bold text-sm hover:bg-error/90 transition-colors"
            >
              Cerrar Sesión
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
