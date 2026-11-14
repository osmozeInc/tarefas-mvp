import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Sun, Layers, Bell, User, Users, Settings, ChevronRight } from 'lucide-react';
import api from '../services/api';

export const BottomMenu: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [socialOpen, setSocialOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setSocialOpen(false);
    const fetchUnread = () => {
      api
        .get('/notifications')
        .then((res) => {
          const unread = res.data.filter((n: any) => !n.read_at).length;
          setUnreadCount(unread);
        })
        .catch(() => {});
    };

    fetchUnread();
    window.addEventListener('notificationsUpdated', fetchUnread);
    return () => window.removeEventListener('notificationsUpdated', fetchUnread);
  }, [location.pathname]);

  const navItems = [
    { to: '/', icon: Sun, label: 'Meu Dia', badge: 0 },
    { to: '/spaces', icon: Layers, label: 'Espaços', badge: 0 },
    { to: '/notifications', icon: Bell, label: 'Alertas', badge: unreadCount },
  ];

  const socialItems = [
    { to: '/profile', icon: User, label: 'Perfil' },
    { to: '/friends', icon: Users, label: 'Amigos' },
    { to: '/settings', icon: Settings, label: 'Configurações' },
  ];

  const isSocialActive =
    socialOpen || ['/profile', '/friends', '/settings'].includes(location.pathname);

  return (
    <>
      {/* Backdrop invisível para fechar o menu Social ao tocar fora */}
      {socialOpen && (
        <div
          onClick={() => setSocialOpen(false)}
          className="fixed inset-0 z-30 bg-black/15 backdrop-blur-[1px]"
        />
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        {/* Menu Flutuante (Select/Popover) do Social */}
        {socialOpen && (
          <div className="absolute bottom-[calc(100%+0.5rem)] right-3 w-48 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xl">
            {socialItems.map(({ to, icon: ItemIcon, label }) => {
              const active = location.pathname === to;
              return (
                <button
                  key={to}
                  type="button"
                  onClick={() => {
                    setSocialOpen(false);
                    navigate(to);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <ItemIcon className="h-4 w-4" />
                    <span>{label}</span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 opacity-40" />
                </button>
              );
            })}
          </div>
        )}

        <div className="flex h-16 items-center justify-around px-2">
          {navItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700'
                }`
              }
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {badge > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </NavLink>
          ))}

          {/* 4º Item: Botão Social que abre o menu flutuante */}
          <button
            type="button"
            onClick={() => setSocialOpen((prev) => !prev)}
            className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors ${
              isSocialActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <User className="h-5 w-5" />
            <span>Social</span>
          </button>
        </div>
      </nav>
    </>
  );
};