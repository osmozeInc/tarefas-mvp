import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

export interface User {
  id: number;
  name: string;
  nickname?: string | null;
  email: string;
  phone?: string | null;
  bio?: string | null;
  status_text?: string | null;
  avatar?: string | null;
  theme_color?: string;
  notifications_enabled?: boolean;
}

export const THEME_OPTIONS = [
  { id: 'orange', label: 'Laranja', hex: '#ea580c' },
  { id: 'emerald', label: 'Esmeralda', hex: '#059669' },
  { id: 'blue', label: 'Azul', hex: '#2563eb' },
  { id: 'rose', label: 'Rubi', hex: '#e11d48' },
  { id: 'amber', label: 'Âmbar', hex: '#d97706' },
  { id: 'slate', label: 'Grafite', hex: '#334155' },
];

export function applyThemeColor(color?: string | null) {
  const theme = color || localStorage.getItem('jarvis_theme') || 'orange';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('jarvis_theme', theme);
}

interface AuthContextData {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  isJarvisOwner: boolean;
  loading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => Promise<void>;
  subscribeToPush: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isJarvisOwner = Boolean(
    user && (user.id === 1 || user.email === 'caio@jarvis.local')
  );

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const { data } = await api.get('/vapid-public-key');
      if (!data.key) return;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.key),
      });

      await api.post('/push-subscriptions', subscription.toJSON());
    } catch (err) {
      console.warn('Não foi possível registar o WebPush:', err);
    }
  };

  useEffect(() => {
    applyThemeColor(localStorage.getItem('jarvis_theme') || 'orange');

    const token = localStorage.getItem('pwa_token');
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get('/user')
      .then((res) => {
        setUser(res.data);
        applyThemeColor(res.data.theme_color || 'orange');
        if (res.data.notifications_enabled !== false) {
          subscribeToPush();
        }
      })
      .catch(() => localStorage.removeItem('pwa_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem('pwa_token', token);
    setUser(userData);
    applyThemeColor(userData.theme_color || 'orange');
    if (userData.notifications_enabled !== false) {
      subscribeToPush();
    }
  };

  const logout = async () => {
    try {
      await api.post('/logout');
    } finally {
      localStorage.removeItem('pwa_token');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, setUser, isJarvisOwner, loading, login, logout, subscribeToPush }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);