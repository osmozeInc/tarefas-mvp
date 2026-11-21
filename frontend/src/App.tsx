import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BottomMenu } from './components/BottomMenu';
import {
  MeuPainelSkeleton,
  HouseDetailSkeleton,
  SpacesListSkeleton,
} from './components/Skeletons';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { MeuDia } from './pages/MeuDia';
import { HouseDetail } from './pages/HouseDetail';
import {
  NotificationsPage,
  ProfilePage,
  FriendsPage,
  SettingsPage,
  TermsPage,
} from './pages/SecondaryPages';

const RouteSkeleton: React.FC = () => {
  const { pathname } = useLocation();

  if (pathname.startsWith('/houses/')) {
    return <HouseDetailSkeleton />;
  }

  if (pathname === '/spaces') {
    return (
      <div className="space-y-4 p-4 pb-24">
        <div className="flex animate-pulse items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-32 rounded-lg bg-slate-200" />
            <div className="h-3 w-44 rounded bg-slate-200" />
          </div>
          <div className="h-9 w-24 rounded-xl bg-slate-200" />
        </div>
        <SpacesListSkeleton />
      </div>
    );
  }

  return <MeuPainelSkeleton />;
};

const PrivateLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-start bg-slate-100 shadow-sm">
        <main className="flex-1">
          <RouteSkeleton />
        </main>
        <BottomMenu />
      </div>
    );
  }

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
          <Route path="/" element={<PrivateLayout><MeuDia /></PrivateLayout>} />
          <Route path="/spaces" element={<PrivateLayout><Home /></PrivateLayout>} />
          <Route path="/houses/:id" element={<PrivateLayout><HouseDetail /></PrivateLayout>} />
          <Route path="/notifications" element={<PrivateLayout><NotificationsPage /></PrivateLayout>} />
          <Route path="/history" element={<Navigate to="/notifications" replace />} />
          <Route path="/profile" element={<PrivateLayout><ProfilePage /></PrivateLayout>} />
          <Route path="/friends" element={<PrivateLayout><FriendsPage /></PrivateLayout>} />
          <Route path="/settings" element={<PrivateLayout><SettingsPage /></PrivateLayout>} />
          <Route path="/terms" element={<PrivateLayout><TermsPage /></PrivateLayout>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}