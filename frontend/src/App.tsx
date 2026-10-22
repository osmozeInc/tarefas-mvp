import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BottomMenu } from './components/BottomMenu';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { HouseDetail } from './pages/HouseDetail';
import { HistoryPage, NotificationsPage, ProfilePage } from './pages/SecondaryPages';

const PrivateLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-sm">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-start bg-slate-100 shadow-sm">
      <main className="flex-1">{children}</main>
      <BottomMenu />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateLayout><Home /></PrivateLayout>} />
          <Route path="/houses/:id" element={<PrivateLayout><HouseDetail /></PrivateLayout>} />
          <Route path="/history" element={<PrivateLayout><HistoryPage /></PrivateLayout>} />
          <Route path="/notifications" element={<PrivateLayout><NotificationsPage /></PrivateLayout>} />
          <Route path="/profile" element={<PrivateLayout><ProfilePage /></PrivateLayout>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}