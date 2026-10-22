import React, { useEffect, useState } from 'react';
import { CheckCircle2, Bell, ShieldCheck, LogOut, CheckCheck, Save } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export const HistoryPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    api.get('/history').then((res) => setItems(res.data));
  }, []);

  return (
    <div className="space-y-3 p-4 pb-24">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Histórico</h1>
        <p className="text-xs text-slate-500">Últimas tarefas concluídas nas suas residências</p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Nenhuma tarefa concluída ainda</p>
          <p className="mt-1 text-xs text-slate-400">As atividades finalizadas aparecerão neste registo.</p>
        </div>
      ) : (
        items.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-2xl bg-white p-3.5 shadow-2xs">
            <div>
              <p className="text-sm font-semibold text-slate-800">{t.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {t.house?.name} {t.assignee ? `• Feito por ${t.assignee.name}` : ''}
              </p>
            </div>
            <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
              {new Date(t.completed_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
        ))
      )}
    </div>
  );
};

export const NotificationsPage: React.FC = () => {
  const [list, setList] = useState<any[]>([]);
  const navigate = useNavigate();
  const load = () => api.get('/notifications').then((res) => setList(res.data));

  useEffect(() => {
    load();
  }, []);

const handleNotificationClick = async (n: any) => {
    if (!n.read_at) {
      await api.patch(`/notifications/${n.id}/read`);
      window.dispatchEvent(new Event('notificationsUpdated'));
    }
    if (n.data?.url) {
      navigate(n.data.url);
    } else {
      load();
    }
  };

const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      // Atualiza o estado local imediatamente na tela sem depender de reload
      setList((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      console.error('Erro ao marcar todas como lidas:', err);
    }
  };

  const hasUnread = list.some((n) => !n.read_at);

  return (
    <div className="space-y-3 p-4 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Central de Alertas</h1>
          <p className="text-xs text-slate-500">Toque no alerta para ver a tarefa</p>
        </div>
        {hasUnread && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-600 active:bg-indigo-100"
          >
            <CheckCheck className="h-4 w-4" /> Ler todas
          </button>
        )}
      </header>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
          <Bell className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Tudo tranquilo por aqui</p>
          <p className="mt-1 text-xs text-slate-400">Você será avisado quando for mencionado em uma tarefa.</p>
        </div>
      ) : (
        list.map((n) => (
          <div
            key={n.id}
            onClick={() => handleNotificationClick(n)}
            className={`cursor-pointer rounded-2xl p-4 shadow-2xs transition ${
              n.read_at ? 'bg-white opacity-60' : 'border-l-4 border-indigo-600 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-indigo-600">{n.data?.house_name}</span>
              {!n.read_at && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
            </div>
            <p className="mt-1 text-sm font-medium text-slate-800">{n.data?.message}</p>
          </div>
        ))
      )}
    </div>
  );
};

export const ProfilePage: React.FC = () => {
  const { user, logout, subscribeToPush } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.put('/user', { name, password: password || undefined });
    setPassword('');
    setStatusMsg('Dados atualizados com sucesso!');
    setTimeout(() => setStatusMsg(''), 3500);
  };

  const handleSyncPush = async () => {
    await subscribeToPush();
    setStatusMsg('Aparelho sincronizado para receber Web Push!');
    setTimeout(() => setStatusMsg(''), 3500);
  };

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold text-slate-900">Meu Perfil</h1>

      <div className="flex items-center gap-3.5 rounded-2xl bg-white p-4 shadow-2xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">
          {name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-slate-900">{name}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700">{statusMsg}</div>
      )}

      <form onSubmit={handleUpdateProfile} className="space-y-3 rounded-2xl bg-white p-4 shadow-2xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Atualizar Cadastro</h2>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nova senha (deixe em branco para manter)"
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs"
        />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white"
        >
          <Save className="h-4 w-4" /> Salvar Alterações
        </button>
      </form>

      <button
        onClick={handleSyncPush}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-50 py-3.5 text-xs font-semibold text-indigo-700 active:bg-indigo-100"
      >
        <ShieldCheck className="h-4 w-4" /> Ativar / Sincronizar Notificações Push neste Aparelho
      </button>

      <button
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 py-3.5 text-xs font-semibold text-red-600 active:bg-red-100"
      >
        <LogOut className="h-4 w-4" /> Sair da Conta
      </button>
    </div>
  );
};