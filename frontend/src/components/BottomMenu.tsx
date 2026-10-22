import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, CheckCircle2, Bell, User } from 'lucide-react';
import api from '../services/api';

export const BottomMenu: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

useEffect(() => {
    const fetchUnread = () => {
      api.get('/notifications')
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
    { to: '/', icon: Home, label: 'Início', badge: 0 },
    { to: '/history', icon: CheckCircle2, label: 'Histórico', badge: 0 },
    { to: '/notifications', icon: Bell, label: 'Alertas', badge: unreadCount },
    { to: '/profile', icon: User, label: 'Perfil', badge: 0 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md border-t border-slate-200 bg-white/95 backdrop-blur-md">
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
      </div>
    </nav>
  );
};