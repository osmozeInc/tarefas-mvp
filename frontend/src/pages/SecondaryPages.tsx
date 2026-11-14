import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Bell,
  ShieldCheck,
  LogOut,
  CheckCheck,
  Save,
  Users,
  Camera,
  Copy,
  Check,
  Search,
  UserPlus,
  UserMinus,
  Send,
  FileText,
  Palette,
  ChevronRight,
  ArrowLeft,
  X,
} from 'lucide-react';
import api from '../services/api';
import { useAuth, THEME_OPTIONS, applyThemeColor } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { SpaceIcon } from '../components/SpaceIcon';

// Utilitário para comprimir foto em 256x256 WebP (~10KB) antes de salvar no banco
function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context error'));

        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/webp', 0.8));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const UserAvatar: React.FC<{
  user?: { name?: string; nickname?: string | null; avatar?: string | null } | null;
  sizeClass?: string;
}> = ({ user, sizeClass = 'h-12 w-12 text-base' }) => {
  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.nickname || user.name || 'Avatar'}
        className={`${sizeClass} shrink-0 rounded-full object-cover border border-slate-200`}
      />
    );
  }
  const initial = (user?.nickname || user?.name || '?').charAt(0).toUpperCase();
  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold text-white`}
    >
      {initial}
    </div>
  );
};

/* ==================== 1. PÁGINA DE ATIVIDADE (ALERTAS + HISTÓRICO) ==================== */
export const NotificationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'history'>('alerts');
  const [list, setList] = useState<any[]>([]);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const navigate = useNavigate();

  const loadNotifications = () =>
    api.get('/notifications').then((res) => setList(res.data)).catch(() => {});

  const loadHistory = () =>
    api.get('/history').then((res) => setHistoryItems(res.data)).catch(() => {});

  useEffect(() => {
    loadNotifications();
    loadHistory();
  }, []);

  const handleNotificationClick = async (n: any) => {
    if (!n.read_at) {
      await api.patch(`/notifications/${n.id}/read`);
      window.dispatchEvent(new Event('notificationsUpdated'));
    }
    if (n.data?.url) {
      navigate(n.data.url);
    } else {
      loadNotifications();
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setList((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      console.error('Erro ao marcar todas como lidas:', err);
    }
  };

  const hasUnread = list.some((n) => !n.read_at);

  return (
    <div className="space-y-4 p-4 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Atividade</h1>
          <p className="text-xs text-slate-500">
            {activeTab === 'alerts'
              ? 'Toque no alerta para abrir'
              : 'Últimas tarefas concluídas nos seus espaços'}
          </p>
        </div>
        {activeTab === 'alerts' && hasUnread && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-600 active:bg-indigo-100"
          >
            <CheckCheck className="h-4 w-4" /> Ler todas
          </button>
        )}
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-200/70 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${
            activeTab === 'alerts' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
          }`}
        >
          <Bell className="h-3.5 w-3.5" />
          <span>Alertas</span>
          {hasUnread && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${
            activeTab === 'history' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Histórico</span>
        </button>
      </div>

      {activeTab === 'alerts' && (
        <div className="space-y-2.5">
          {list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
              <Bell className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Tudo tranquilo por aqui</p>
              <p className="mt-1 text-xs text-slate-400">
                Você será avisado quando houver novidades ou solicitações.
              </p>
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
                  <span className="text-[11px] font-bold uppercase text-indigo-600">
                    {n.data?.house_name}
                  </span>
                  {!n.read_at && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                </div>
                <p className="mt-1 text-sm font-medium text-slate-800">{n.data?.message}</p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-2.5">
          {historyItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Nenhuma tarefa concluída ainda</p>
              <p className="mt-1 text-xs text-slate-400">
                As atividades finalizadas aparecerão neste registro.
              </p>
            </div>
          ) : (
            historyItems.map((t) => (
              <div key={t.id} className="rounded-2xl bg-white p-3.5 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{t.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {t.house?.name} {t.assignee ? `• Feito por ${t.assignee.name}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                    {new Date(t.completed_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                {t.completion_note && (
                  <p className="mt-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">
                    {t.completion_note}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

/* ==================== 2. PÁGINA DE PERFIL ==================== */
export const ProfilePage: React.FC = () => {
  const { user, setUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name || '');
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [statusText, setStatusText] = useState(user?.status_text || '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar || null);

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file);
      setAvatar(compressed);
    } catch {
      setErrorMsg('Não foi possível processar a imagem selecionada.');
    }
  };

  const copyMyId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(String(user.id));
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');

    if (password && password !== passwordConfirmation) {
      setErrorMsg('A confirmação da nova senha não confere.');
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.put('/user', {
        name: name.trim(),
        nickname: nickname.trim() || null,
        email: email.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        status_text: statusText.trim() || null,
        avatar,
        password: password || undefined,
        password_confirmation: password ? passwordConfirmation : undefined,
      });
      setUser(data);
      setPassword('');
      setPasswordConfirmation('');
      setStatusMsg('Perfil atualizado com sucesso!');
      setTimeout(() => setStatusMsg(''), 3500);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Erro ao atualizar perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Meu Perfil</h1>
          <p className="text-xs text-slate-500">Suas informações públicas e credenciais</p>
        </div>
        <button
          type="button"
          onClick={copyMyId}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-slate-700 shadow-2xs"
          title="Seu ID único para conexões"
        >
          <span>ID #{user?.id}</span>
          {copiedId ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-slate-400" />
          )}
        </button>
      </header>

      {/* Card da Foto e Identidade */}
      <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-2xs">
        <div className="relative">
          <UserAvatar user={{ name, nickname, avatar }} sizeClass="h-16 w-16 text-xl" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white shadow-md hover:bg-indigo-600"
            title="Alterar foto"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-slate-900">
            {nickname || name}
          </p>
          <p className="truncate text-xs text-slate-500">{name}</p>
          {avatar && (
            <button
              type="button"
              onClick={() => setAvatar(null)}
              className="mt-1 text-[11px] font-semibold text-red-500 hover:underline"
            >
              Remover foto
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleUpdateProfile} className="space-y-4">
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Identidade Pessoal
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Apelido</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Como quer ser chamado"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">
                Status Rápido
              </label>
              <input
                type="text"
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                placeholder="Ex: Focado, Em aula..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">
              Nome Completo *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">
              Descrição Pessoal (Bio)
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Fale brevemente sobre você, sua área ou rotina..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs leading-relaxed"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Contato e Segurança
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">E-mail *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Celular</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(88) 99999-9999"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">
                Nova Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Em branco para manter"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">
                Confirmar Senha
              </label>
              <input
                type="password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                placeholder="Repita a nova senha"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 py-3 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar Perfil'}
        </button>
      </form>
    </div>
  );
};

/* ==================== 3. PÁGINA DE AMIGOS E SOLICITAÇÕES ==================== */
export const FriendsPage: React.FC = () => {
  const [social, setSocial] = useState<{
    friends: any[];
    friend_requests: any[];
    space_invites: any[];
    my_spaces: any[];
  }>({
    friends: [],
    friend_requests: [],
    space_invites: [],
    my_spaces: [],
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Modal para convidar um amigo para um Espaço
  const [inviteFriendModal, setInviteFriendModal] = useState<any | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | ''>('');

  const loadSocial = async () => {
    try {
      const { data } = await api.get('/social/state');
      setSocial(data);
      if (!selectedSpaceId && data.my_spaces?.length > 0) {
        setSelectedSpaceId(data.my_spaces[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar conexões:', err);
    }
  };

  useEffect(() => {
    loadSocial();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await api.get(`/social/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchResults(data);
    } finally {
      setSearching(false);
    }
  };

  const handleSocialAction = async (payload: any, msg?: string) => {
    await api.post('/social/action', payload);
    if (msg) {
      setFeedback(msg);
      setTimeout(() => setFeedback(''), 3000);
    }
    await loadSocial();
    if (searchQuery.trim()) {
      const { data } = await api.get(`/social/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchResults(data);
    }
  };

  const totalPending =
    (social.friend_requests?.length || 0) + (social.space_invites?.length || 0);

  return (
    <div className="space-y-5 p-4 pb-24">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Amigos e Conexões</h1>
        <p className="text-xs text-slate-500">
          Pesquise por Nome, Apelido, E-mail ou #ID. Toda conexão exige autorização.
        </p>
      </header>

      {feedback && (
        <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
          {feedback}
        </div>
      )}

      {/* BUSCA DE USUÁRIOS (NOME, APELIDO, EMAIL OU #ID) */}
      <div className="space-y-2.5 rounded-2xl bg-white p-4 shadow-2xs">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar nome, apelido, e-mail ou #ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs focus:border-indigo-600 focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
          >
            {searching ? '...' : 'Buscar'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-2 border-t border-slate-100 pt-2.5">
            {searchResults.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <UserAvatar user={u} sizeClass="h-10 w-10 text-xs" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {u.nickname || u.name}
                      </p>
                      <span className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                        #{u.id}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-slate-500">{u.name}</p>
                  </div>
                </div>

                {u.friendship_status === 'accepted' ? (
                  <span className="text-[11px] font-semibold text-emerald-600">Já é amigo</span>
                ) : u.friendship_status === 'pending' ? (
                  <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    Solicitado
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      handleSocialAction(
                        { action: 'send_friend_request', target_id: u.id },
                        `Pedido de amizade enviado para ${u.nickname || u.name}!`
                      )
                    }
                    className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Conectar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SOLICITAÇÕES PENDENTES (AMIZADE + CONVITES DE ESPAÇO) */}
      {totalPending > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Solicitações Pendentes ({totalPending})
          </h2>

          {/* Pedidos de Amizade */}
          {social.friend_requests.map((req) => (
            <div
              key={`freq_${req.request_id}`}
              className="flex items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-white p-3.5 shadow-2xs"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <UserAvatar user={req} sizeClass="h-10 w-10 text-xs" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {req.nickname || req.name}
                    </p>
                    <span className="font-mono text-[10px] font-bold text-slate-400">
                      #{req.user_id}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Quer se conectar com você</p>
                </div>
              </div>

              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    handleSocialAction({
                      action: 'respond_friend_request',
                      request_id: req.request_id,
                      decision: 'decline',
                    })
                  }
                  className="rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600"
                >
                  Recusar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSocialAction(
                      {
                        action: 'respond_friend_request',
                        request_id: req.request_id,
                        decision: 'accept',
                      },
                      'Amizade confirmada!'
                    )
                  }
                  className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Aceitar
                </button>
              </div>
            </div>
          ))}

          {/* Convites para participar de Espaços */}
          {social.space_invites.map((inv) => (
            <div
              key={`sinv_${inv.invite_id}`}
              className="flex items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 shadow-2xs"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-2xs">
                  <SpaceIcon icon={inv.house_icon} className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-900">
                    Espaço: {inv.house_name}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Convidado por {inv.inviter_nickname || inv.inviter_name} (#{inv.inviter_id})
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    handleSocialAction({
                      action: 'respond_space_invite',
                      request_id: inv.invite_id,
                      decision: 'decline',
                    })
                  }
                  className="rounded-xl bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600"
                >
                  Recusar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSocialAction(
                      {
                        action: 'respond_space_invite',
                        request_id: inv.invite_id,
                        decision: 'accept',
                      },
                      `Você entrou no espaço ${inv.house_name}!`
                    )
                  }
                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Entrar
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* LISTA DE AMIGOS CONECTADOS */}
      <section className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Meus Amigos ({social.friends.length})
        </h2>

        {social.friends.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Nenhuma conexão ainda</p>
            <p className="mt-1 text-xs text-slate-400">
              Use a busca acima para encontrar amigos pelo nome ou #ID.
            </p>
          </div>
        ) : (
          social.friends.map((friend) => (
            <div
              key={friend.id}
              className="flex items-center justify-between gap-2 rounded-2xl bg-white p-3.5 shadow-2xs"
            >
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar user={friend} sizeClass="h-11 w-11 text-sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {friend.nickname || friend.name}
                    </p>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500">
                      #{friend.id}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {friend.status_text || friend.name}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setInviteFriendModal(friend)}
                  className="flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100"
                >
                  <Send className="h-3 w-3" /> Convidar p/ Espaço
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Remover ${friend.nickname || friend.name} dos seus amigos?`)) {
                      handleSocialAction({ action: 'remove_friend', target_id: friend.id });
                    }
                  }}
                  className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title="Desfazer amizade"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* MODAL PARA ENVIAR SOLICITAÇÃO DE ESPAÇO A UM AMIGO */}
      {inviteFriendModal && (
        <div
          onClick={() => setInviteFriendModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Convidar {inviteFriendModal.nickname || inviteFriendModal.name}
              </h3>
              <button
                type="button"
                onClick={() => setInviteFriendModal(null)}
                className="rounded-lg bg-slate-100 p-1 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Escolha o espaço abaixo. Uma solicitação será enviada e a pessoa só entrará após aceitar:
            </p>

            <select
              value={selectedSpaceId}
              onChange={(e) => setSelectedSpaceId(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium"
            >
              {social.my_spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInviteFriendModal(null)}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = inviteFriendModal;
                  setInviteFriendModal(null);
                  await handleSocialAction(
                    {
                      action: 'send_space_invite',
                      target_id: target.id,
                      house_id: Number(selectedSpaceId),
                    },
                    `Convite enviado para ${target.nickname || target.name}!`
                  );
                }}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white"
              >
                Enviar Solicitação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ==================== 4. PÁGINA DE CONFIGURAÇÕES ==================== */
export const SettingsPage: React.FC = () => {
  const { user, setUser, logout, subscribeToPush } = useAuth();
  const navigate = useNavigate();

  const [themeColor, setThemeColor] = useState(
    user?.theme_color || localStorage.getItem('jarvis_theme') || 'orange'
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    user?.notifications_enabled ?? true
  );
  const [statusMsg, setStatusMsg] = useState('');

  const handleSelectTheme = async (colorId: string) => {
    setThemeColor(colorId);
    applyThemeColor(colorId);
    try {
      const { data } = await api.put('/user', { theme_color: colorId });
      setUser(data);
      setStatusMsg('Cor do ambiente atualizada!');
      setTimeout(() => setStatusMsg(''), 2500);
    } catch {
      // Mantém aplicado localmente mesmo se offline
    }
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    try {
      const { data } = await api.put('/user', { notifications_enabled: enabled });
      setUser(data);
      if (enabled) {
        await subscribeToPush();
      }
      setStatusMsg(
        enabled ? 'Notificações ativadas!' : 'Notificações silenciadas.'
      );
      setTimeout(() => setStatusMsg(''), 2500);
    } catch {
      // Silencioso
    }
  };

  return (
    <div className="space-y-4 p-4 pb-24">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Configurações</h1>
        <p className="text-xs text-slate-500">Personalize cores, alertas e privacidade</p>
      </header>

      {statusMsg && (
        <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
          {statusMsg}
        </div>
      )}

      {/* Personalização de Cores do Ambiente */}
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Palette className="h-3.5 w-3.5" /> Cor de Preferência do Ambiente
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSelectTheme(t.id)}
              className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                themeColor === t.id
                  ? 'border-slate-900 bg-slate-50 text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              <span
                className="h-4 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: t.hex }}
              />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Controle de Notificações */}
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Bell className="h-3.5 w-3.5" /> Notificações e Alertas
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div>
            <p className="text-xs font-semibold text-slate-800">Permitir Notificações</p>
            <p className="text-[11px] text-slate-500">
              Receber alertas de tarefas, menções e solicitações
            </p>
          </div>
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => handleToggleNotifications(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
        </label>

        {notificationsEnabled && (
          <button
            type="button"
            onClick={() => handleToggleNotifications(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-50 py-2.5 text-xs font-semibold text-indigo-700 active:bg-indigo-100"
          >
            <ShieldCheck className="h-4 w-4" /> Sincronizar Web Push neste Aparelho
          </button>
        )}
      </div>

      {/* Link para Termos e Políticas */}
      <div className="rounded-2xl bg-white p-2 shadow-2xs">
        <button
          type="button"
          onClick={() => navigate('/terms')}
          className="flex w-full items-center justify-between rounded-xl p-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <span className="flex items-center gap-2.5">
            <FileText className="h-4 w-4 text-slate-400" />
            <span>Termos de Uso e Políticas de Privacidade</span>
          </span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      <button
        type="button"
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 py-3.5 text-xs font-semibold text-red-600 active:bg-red-100"
      >
        <LogOut className="h-4 w-4" /> Sair da Conta
      </button>
    </div>
  );
};

/* ==================== 5. PÁGINA DE TERMOS E POLÍTICAS (ROTA CRIADA) ==================== */
export const TermsPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-4 p-4 pb-24">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <div className="rounded-2xl bg-white p-5 shadow-2xs">
        <h1 className="text-lg font-bold text-slate-900">
          Termos de Uso e Políticas de Privacidade
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Esta rota está reservada para o documento oficial de Termos de Uso e Políticas de
          Privacidade do sistema.
        </p>
      </div>
    </div>
  );
};