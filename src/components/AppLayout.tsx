"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Portal from "./Portal";
import { useNotifications } from "@/contexts/NotificationContext";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from '@/utils/supabase/client';

export default function AppLayout({ children, role }: { children: React.ReactNode, role?: string }) {
  const pathname = usePathname();
  const isLoginRoute = pathname === '/login';
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // Estados para la edición de perfil
  const [profileName, setProfileName] = useState("Cargando...");
  const [profilePic, setProfilePic] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, requestPermission, permissionGranted } = useNotifications();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        const meta = session.user.user_metadata;
        const fullName = meta?.first_name ? `${meta.first_name} ${meta.last_name || ''}`.trim() : '';
        setProfileName(fullName);
        if (meta?.avatar_url) setProfilePic(meta.avatar_url);
      }
    };
    loadProfile();
  }, []);

  const handleSaveProfile = async () => {
    if (!userId) return;
    try {
      const names = profileName.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ');
      
      await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          avatar_url: profilePic
        }
      });
      setIsProfileModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  // Determinar color de avatar basado en el rol
  const getRoleColor = (r?: string) => {
    switch(r) {
      case 'superuser': return 'bg-primary text-on-primary';
      case 'professional': return 'bg-[#34D399] text-white';
      case 'secretary': return 'bg-[#60A5FA] text-white';
      default: return 'bg-surface-container-high text-on-surface';
    }
  };

  // Obtener iniciales (ej. "Dra. Bina" -> "DB")
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  let navItems = [
    { name: "Dashboard", href: "/", icon: "dashboard" },
    { name: "Pacientes", href: "/patients", icon: "group" },
    { name: "Agenda", href: "/calendar", icon: "calendar_month" },
    { name: "Aranceles y O.S.", href: "/pricing", icon: "account_balance_wallet" },
    { name: "Finanzas", href: "/finance", icon: "payments" },
  ];

  const roleLabels: Record<string, string> = {
    superuser: 'Superusuario',
    professional: 'Profesional',
    secretary: 'Secretaría'
  };
  const displayRole = role ? roleLabels[role] || 'Usuario' : 'Cargando...';

  if (role === 'secretary') {
    navItems = navItems.filter(item => item.name !== "Finanzas");
  }

  if (isLoginRoute) {
    return <main className="min-h-screen bg-surface">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* TopAppBar for Mobile */}
      <header className="fixed top-0 w-full z-50 bg-surface shadow-[0px_10px_30px_rgba(146,130,113,0.08)] flex justify-between items-center px-margin-mobile md:px-margin-desktop h-20 md:hidden">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-semibold text-primary">Bina</h1>
        <div className="flex items-center gap-md">
          <div className="relative">
            <span 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="material-symbols-outlined text-primary cursor-pointer hover:bg-surface-container-high p-2 rounded-full transition-colors"
            >
              notifications
            </span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 bg-error rounded-full border border-surface"></span>
            )}
          </div>
        </div>
      </header>


      {/* Sidebar Izquierdo (Desktop) */}
      <aside className="fixed top-0 left-0 h-screen w-20 bg-surface-container-lowest border-r border-outline-variant flex-col items-center py-6 hidden md:flex z-50 shadow-sm transition-all duration-300 hover:w-64 group overflow-hidden">
        {/* Logo */}
        <div className="w-full h-20 px-2 flex items-center justify-center shrink-0 mb-6 mt-4 hover:scale-105 transition-transform duration-300">
          <img src="/images/logo_b.png" alt="Bina Logo" className="w-auto h-full object-contain drop-shadow-sm" />
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 w-full flex flex-col gap-2 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name}
                href={item.href}
                className={`flex items-center h-12 rounded-2xl transition-all ${
                  isActive ? "bg-primary-container text-on-primary-container font-bold shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-medium"
                }`}
                title={item.name}
              >
                <div className="w-14 h-full flex items-center justify-center shrink-0">
                  <span 
                    className="material-symbols-outlined text-[22px]" 
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                  >
                    {item.icon}
                  </span>
                </div>
                <span className="opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity duration-300 text-sm">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* Main Content Area */}
      <main className="md:ml-20 min-h-screen pt-20 md:pt-0 pb-20 md:pb-0 transition-all duration-300 relative flex flex-col">
        {/* Top Right Desktop Header Pill */}
        <div className="hidden md:flex absolute top-4 right-8 z-50 items-center gap-1 bg-surface-container-lowest shadow-sm rounded-[18px] p-1.5 pr-1.5 border border-outline-variant/30" ref={notifRef}>
          
          {/* Profile Area */}
          <div 
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-2 pl-2 pr-3 cursor-pointer hover:bg-surface-container-low rounded-xl transition-colors h-10"
          >
            {profilePic ? (
              <img src={profilePic} alt="Perfil" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] ${getRoleColor(role)}`}>
                {getInitials(profileName || displayRole)}
              </div>
            )}
            <span className="text-sm font-bold text-on-surface">{profileName || displayRole}</span>
          </div>

          {/* Settings Button */}
          <Link href="/settings" className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-colors">
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </Link>

          {/* Notification Button */}
          <div className="relative">
            <button 
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                if (!permissionGranted) requestPermission();
              }}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${isNotifOpen ? 'bg-primary-container text-primary' : 'bg-bina-madera/20 text-bina-taupe hover:bg-bina-madera/30'} relative`}
            >
              <span className="material-symbols-outlined text-[20px]">{isNotifOpen ? 'notifications_active' : 'notifications'}</span>
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-error rounded-full border-2 border-surface-container-lowest"></span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest border border-outline-variant shadow-xl rounded-2xl overflow-hidden z-50">
                <div className="p-4 border-b border-outline-variant/50 flex justify-between items-center bg-surface-container-low/50">
                  <h3 className="font-bold text-on-surface">Notificaciones</h3>
                  {notifications.length > 0 && (
                    <div className="flex gap-3">
                      {unreadCount > 0 && (
                        <button onClick={markAllAsRead} className="text-xs font-bold text-primary hover:underline">Leídas</button>
                      )}
                      <button onClick={clearAll} className="text-xs font-bold text-error hover:underline">Eliminar todas</button>
                    </div>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-on-surface-variant flex flex-col items-center">
                      <span className="material-symbols-outlined text-4xl mb-2 opacity-50">notifications_paused</span>
                      <p className="text-sm">No tienes notificaciones.</p>
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        onClick={() => {
                          markAsRead(notif.id);
                          if (notif.actionUrl) window.location.href = notif.actionUrl;
                          setIsNotifOpen(false);
                        }}
                        className={`p-4 border-b border-outline-variant/30 hover:bg-surface-container-low cursor-pointer transition-colors flex gap-3 ${!notif.read ? 'bg-primary/5' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${notif.type === 'appointment' ? 'bg-primary-container text-primary' : 'bg-red-100 text-red-600'}`}>
                          <span className="material-symbols-outlined text-[16px]">
                            {notif.type === 'appointment' ? 'calendar_clock' : 'account_balance_wallet'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <p className={`text-sm mb-0.5 ${!notif.read ? 'font-bold text-on-surface' : 'font-medium text-on-surface-variant'}`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-on-surface-variant line-clamp-2 leading-snug mb-1">
                            {notif.message}
                          </p>
                          <span className="text-[10px] font-medium text-on-surface-variant/70 uppercase">
                            {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true, locale: es })}
                          </span>
                        </div>
                        {!notif.read && <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0"></div>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {children}
      </main>

      {/* Bottom Navigation Bar (Mobile) */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center h-16 px-1 pb-safe bg-surface shadow-[0px_-4px_20px_rgba(146,130,113,0.1)] md:hidden z-50 rounded-t-xl">
        {navItems.slice(0,4).map((item) => {
          const isActive = pathname === item.href;
          const shortName = item.name === "Aranceles y O.S." ? "Aranceles" : item.name;
          return (
            <Link 
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center transition-all flex-1 min-w-0 py-1 ${
                isActive ? "text-primary-container" : "text-on-surface-variant active:bg-surface-container-high"
              }`}
            >
              <span 
                className={`material-symbols-outlined ${isActive ? 'scale-110 mb-0.5' : ''} transition-transform text-[22px]`} 
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {item.icon}
              </span>
              <span className={`font-medium text-[10px] truncate w-full text-center px-1 transition-all ${isActive ? 'font-bold' : ''}`}>{shortName}</span>
            </Link>
          );
        })}
      </nav>

      {/* Modal de Perfil */}
      {isProfileModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 px-4">
          <div className="bg-surface w-full max-w-[360px] rounded-[2rem] p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            
            <h2 className="font-title-md text-lg font-bold text-on-surface mb-5 text-center">Editar Perfil</h2>
            
            <div className="flex flex-col items-center mb-5 relative">
              <div className="relative group cursor-pointer">
                {profilePic ? (
                  <img 
                    src={profilePic} 
                    alt="Perfil" 
                    className="w-20 h-20 rounded-full object-cover border-4 border-surface-container shadow-sm"
                  />
                ) : (
                  <div className={`w-20 h-20 rounded-full border-4 border-surface-container shadow-sm flex items-center justify-center font-bold text-2xl ${getRoleColor(role)}`}>
                    {getInitials(profileName)}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-white text-[20px]">photo_camera</span>
                </div>
              </div>
              <p className="text-[11px] text-primary font-semibold mt-2 cursor-pointer hover:underline">Cambiar foto</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Nombre</label>
                <input 
                  type="text" 
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-sm text-on-surface font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Rol de Sistema</label>
                <input 
                  type="text" 
                  value={displayRole}
                  disabled
                  className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-xl px-3 py-2 text-sm text-on-surface-variant font-medium opacity-70 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-full font-label-sm text-sm bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveProfile}
                className="flex-1 py-2.5 px-4 rounded-full font-label-sm text-sm bg-primary hover:bg-primary/90 text-on-primary transition-colors shadow-sm"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
