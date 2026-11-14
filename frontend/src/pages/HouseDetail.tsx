import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cache } from '../services/cache';
import {
  ArrowLeft,
  Plus,
  Send,
  CheckCircle2,
  Copy,
  Check,
  UserMinus,
  Settings,
  Search,
  Trophy,
  LogOut,
  Play,
  Pause,
  UserPlus,
  ListTodo,
  ListChecks,
  StickyNote,
  X,
  ChevronDown,
  Zap,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ItemModal } from '../components/ItemModal';
import { SpaceIcon, SPACE_ICON_OPTIONS, normalizeIconKey } from '../components/SpaceIcon';

export const HouseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<'tasks' | 'chat' | 'dashboard'>('tasks');

  // Filtros: Tudo | Para mim | Concluído + Selects Quando e Tipos
  const [statusFilter, setStatusFilter] = useState<'all' | 'mine' | 'done'>('all');
  const [whenFilter, setWhenFilter] = useState<'all' | 'today' | 'overdue' | 'future' | 'nodate'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'task' | 'list' | 'note'>('all');
  const [search, setSearch] = useState('');

  const [house, setHouse] = useState<any>(() => cache.get(`house_${id}`, null));
  const [tasks, setTasks] = useState<any[]>(() => cache.get(`tasks_${id}`, []));
  const [messages, setMessages] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(() => cache.get(`stats_${id}`, null));
  const [copied, setCopied] = useState(false);

  // Speed Dial (+) e Modais
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<any | null>(null);
  const [createType, setCreateType] = useState<'task' | 'list' | 'note' | null>(null);

  // Modal de Conclusão
  const [completingTask, setCompletingTask] = useState<any>(null);
  const [completionNote, setCompletionNote] = useState('');

  // Edição completa do Espaço (Nome, Descrição, Ícone e Membros)
  const [houseName, setHouseName] = useState('');
  const [houseDesc, setHouseDesc] = useState('');
  const [houseIcon, setHouseIcon] = useState('folder');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [savingHouse, setSavingHouse] = useState(false);

  // Estado do Chat
  const [chatInput, setChatInput] = useState('');

  const myRole = house?.members?.find((m: any) => m.id === user?.id)?.pivot?.role || 'guest';
  const canInteract = myRole === 'owner' || myRole === 'resident';
  const isOwner = myRole === 'owner';

  const syncHouseForm = (houseData: any) => {
    setHouse(houseData);
    setHouseName(houseData.name || '');
    setHouseDesc(houseData.description || '');
    setHouseIcon(normalizeIconKey(houseData.icon));
    setSelectedMemberIds(
      houseData.members ? houseData.members.map((m: any) => m.id) : []
    );
  };

  const loadData = async (force = false) => {
    if (!force && cache.isFresh(`house_${id}`, 120000) && cache.isFresh(`tasks_${id}`, 120000)) {
      return;
    }

    const [houseRes, tasksRes] = await Promise.all([
      api.get(`/houses/${id}`),
      api.get(`/houses/${id}/tasks`),
    ]);

    cache.set(`house_${id}`, houseRes.data);
    cache.set(`tasks_${id}`, tasksRes.data);

    syncHouseForm(houseRes.data);
    setTasks(tasksRes.data);

    api.get('/jarvis/state').then((res) => {
      cache.set('meu_dia', res.data);
      if (res.data?.spaces) cache.set('houses_list', res.data.spaces);
    }).catch(() => {});
  };

  const loadStats = async () => {
    const { data } = await api.get(`/houses/${id}/dashboard`);
    cache.set(`stats_${id}`, data);
    setStats(data);
  };

  const loadMessages = async () => {
    const { data } = await api.get(`/houses/${id}/messages`);
    setMessages(data);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    const cachedHouse = cache.get<any>(`house_${id}`, null);
    if (cachedHouse) {
      syncHouseForm(cachedHouse);
    }
    setTasks(cache.get(`tasks_${id}`, []));
    setStats(cache.get(`stats_${id}`, null));

    loadData(false);
  }, [id]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    setFabMenuOpen(false);

    if (tab === 'dashboard') {
      loadStats();
    }
    if (tab === 'chat') {
      loadMessages();
      const interval = setInterval(loadMessages, 4000);
      return () => clearInterval(interval);
    }
  }, [tab, id]);

  useEffect(() => {
    if (tab === 'chat' && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages.length, tab]);

  const copyInviteCode = () => {
    if (!house?.invite_code) return;
    navigator.clipboard.writeText(house.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openCreateByType = (chosenType: 'task' | 'list' | 'note') => {
    setFabMenuOpen(false);
    setActiveItem(null);
    setCreateType(chosenType);
    setModalOpen(true);
  };

  const openDetailModal = (task: any) => {
    setFabMenuOpen(false);
    setCreateType(null);
    setActiveItem({ ...task, house_id: task.house_id || Number(id) });
    setModalOpen(true);
  };

  const handleSaveItem = async (payload: any) => {
    await api.post('/jarvis/action', payload);
    await loadData(true);
  };

  const handleDeleteItem = async (taskId: number) => {
    await api.post('/jarvis/action', { action: 'delete', task_id: taskId });
    setModalOpen(false);
    setActiveItem(null);
    await loadData(true);
  };

  const handleTaskAction = async (action: string, taskId: number, note?: string) => {
    if (!canInteract) return;
    setCompletingTask(null);
    setCompletionNote('');
    await api.post('/jarvis/action', {
      action,
      task_id: taskId,
      completion_note: note || undefined,
    });
    await loadData(true);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !canInteract) return;
    await api.post(`/houses/${id}/messages`, { content: chatInput });
    setChatInput('');
    loadMessages();
  };

  const handleRoleChange = async (memberId: number, role: string) => {
    await api.patch(`/houses/${id}/members/${memberId}/role`, { role });
    loadData(true);
  };

  const handleRemoveMember = async (memberId: number, memberName: string) => {
    if (!window.confirm(`Remover ${memberName} deste espaço?`)) return;
    await api.delete(`/houses/${id}/members/${memberId}`);
    loadData(true);
  };

  const handleLeaveHouse = async () => {
    if (!window.confirm('Deseja sair deste espaço?')) return;
    await api.post(`/houses/${id}/leave`);
    navigate('/');
  };

  const handleUpdateHouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHouse(true);
    try {
      await api.post('/jarvis/action', {
        action: 'update_space',
        house_id: Number(id),
        name: houseName.trim(),
        description: houseDesc.trim() || null,
        icon: houseIcon,
        member_ids: selectedMemberIds,
      });
      await loadData(true);
    } finally {
      setSavingHouse(false);
    }
  };

  const handleDeleteHouse = async () => {
    if (!window.confirm('Tem certeza que deseja excluir este espaço e todos os seus itens?')) return;
    await api.delete(`/houses/${id}`);
    navigate('/');
  };

  const allSpaces = cache.get<any[]>('houses_list', house ? [house] : []);
  const spacesWithCurrent =
    house && !allSpaces.some((s: any) => s.id === house.id) ? [house, ...allSpaces] : allSpaces;

  // Todos os contatos conhecidos nos outros espaços para adicionar/remover facilmente na edição do espaço
  const knownContacts = useMemo(() => {
    const map = new Map<number, { id: number; name: string; email: string }>();
    spacesWithCurrent.forEach((s: any) => {
      s?.members?.forEach((m: any) => {
        if (m.id !== user?.id) map.set(m.id, m);
      });
    });
    return Array.from(map.values());
  }, [spacesWithCurrent, user?.id]);

  // Filtragem e Ordenação Estrita: 1º Tarefas (por urgência) -> 2º Listas -> 3º Notas
  const { sortedTasksOnly, sortedListsOnly, sortedNotesOnly, totalFiltered } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const filtered = tasks.filter((t) => {
      const normalizedType = t.type === 'list' ? 'list' : t.type === 'note' ? 'note' : 'task';

      if (statusFilter === 'done') {
        if (!t.completed_at) return false;
      } else {
        if (t.completed_at) return false;
        if (statusFilter === 'mine' && t.assigned_to !== user?.id) return false;
      }

      if (typeFilter !== 'all' && normalizedType !== typeFilter) return false;

      if (whenFilter !== 'all') {
        if (whenFilter === 'nodate') {
          if (t.due_date) return false;
        } else {
          if (!t.due_date) return false;
          const due = new Date(t.due_date);
          if (whenFilter === 'overdue' && due >= startOfToday) return false;
          if (whenFilter === 'today' && due > endOfToday) return false;
          if (whenFilter === 'future' && due <= endOfToday) return false;
        }
      }

      if (search.trim() && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    const weight: Record<string, number> = { high: 3, medium: 2, low: 1 };

    const tList = filtered
      .filter((t) => t.type !== 'list' && t.type !== 'note')
      .sort((a, b) => {
        // 1. Em foco primeiro
        const focusA = a.in_progress_by && !a.completed_at ? 1 : 0;
        const focusB = b.in_progress_by && !b.completed_at ? 1 : 0;
        if (focusA !== focusB) return focusB - focusA;

        // 2. Prioridade (Alta > Média > Baixa)
        const pA = weight[a.priority] || 2;
        const pB = weight[b.priority] || 2;
        if (pA !== pB) return pB - pA;

        // 3. Prazo mais próximo
        const dA = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const dB = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        if (dA !== dB) return dA - dB;

        // 4. Ordem alfabética
        return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR');
      });

    const lList = filtered
      .filter((t) => t.type === 'list')
      .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR'));

    const nList = filtered
      .filter((t) => t.type === 'note')
      .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR'));

    return {
      sortedTasksOnly: tList,
      sortedListsOnly: lList,
      sortedNotesOnly: nList,
      totalFiltered: tList.length + lList.length + nList.length,
    };
  }, [tasks, statusFilter, typeFilter, whenFilter, search, user?.id]);

  if (!house) return <div className="p-8 text-center text-sm text-slate-500">Carregando espaço...</div>;

  const whenLabelMap: Record<string, string> = {
    all: 'Quando',
    today: 'Hoje',
    overdue: 'Atrasadas',
    future: 'Futuras',
    nodate: 'Sem prazo',
  };

  const typeLabelMap: Record<string, string> = {
    all: 'Tipos',
    task: 'Tarefas',
    list: 'Listas',
    note: 'Notas',
  };

  const totalWeekTasks = (stats?.completed_this_week || 0) + (stats?.pending_total || 0);
  const progressPercent = totalWeekTasks > 0 ? Math.round((stats.completed_this_week / totalWeekTasks) * 100) : 0;

  return (
    <div className="flex min-h-dvh flex-col pb-20">
      {/* CONTAINER STICKY: Header Branco + Busca/Filtros soltos no fundo cinza */}
      <div className="sticky top-0 z-30">
        <div className="border-b border-slate-200 bg-white/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
          <div className="flex items-center justify-between pb-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>

            {/* Lado direito dedicado 100% ao Ícone e Nome do Espaço */}
            <div className="flex items-center gap-1.5 text-slate-900">
              <SpaceIcon icon={house.icon} className="h-4 w-4 text-indigo-600" />
              <h1 className="text-sm font-bold">{house.name}</h1>
            </div>
          </div>

          <div className="flex border-t border-slate-100 text-xs font-semibold">
            {(['tasks', 'chat', 'dashboard'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 border-b-2 py-2.5 transition-colors ${
                  tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'
                }`}
              >
                {t === 'tasks'
                  ? `Itens (${tasks.filter((i) => !i.completed_at).length})`
                  : t === 'chat'
                  ? 'Chat'
                  : 'Dashboard'}
              </button>
            ))}
          </div>
        </div>

        {/* Busca e Filtros Soltos no Topo */}
        {tab === 'tasks' && (
          <div className="space-y-2 bg-slate-100/95 px-4 pt-3 pb-2 backdrop-blur-xs">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar no espaço..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs shadow-2xs focus:border-indigo-600 focus:outline-none"
              />
            </div>

            {/* Todos os filtros renderizados com <span className="text-[11px] font-medium"> idênticos */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {[
                { id: 'all', label: 'Tudo' },
                { id: 'mine', label: 'Para mim' },
                { id: 'done', label: 'Concluído' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id as any)}
                  className={`inline-flex h-7 shrink-0 items-center justify-center rounded-full px-3 text-[11px] font-medium transition ${
                    statusFilter === f.id
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 shadow-2xs'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              {/* Select "Quando" com sobreposição transparente (mesma fonte e altura dos botões) */}
              <div
                className={`relative inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition ${
                  whenFilter !== 'all'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 shadow-2xs'
                }`}
              >
                <span>{whenLabelMap[whenFilter]}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
                <select
                  value={whenFilter}
                  onChange={(e) => setWhenFilter(e.target.value as any)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                >
                  <option value="all">Quando (Todos)</option>
                  <option value="today">Hoje</option>
                  <option value="overdue">Atrasadas</option>
                  <option value="future">Futuras</option>
                  <option value="nodate">Sem prazo</option>
                </select>
              </div>

              {/* Select "Tipos" com sobreposição transparente (mesma fonte e altura dos botões) */}
              <div
                className={`relative inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition ${
                  typeFilter !== 'all'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 shadow-2xs'
                }`}
              >
                <span>{typeLabelMap[typeFilter]}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                >
                  <option value="all">Tipos (Todos)</option>
                  <option value="task">Tarefas</option>
                  <option value="list">Listas</option>
                  <option value="note">Notas</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ABA 1: ITENS ORDENADOS (1º Tarefas -> 2º Listas em 2 colunas -> 3º Notas em 2 colunas) */}
      {tab === 'tasks' && (
        <div className="flex-1 space-y-4 px-4 pb-4 pt-1">
          {totalFiltered === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
              <p className="text-sm font-medium text-slate-600">Nenhum registro encontrado</p>
              <p className="mt-1 text-xs text-slate-400">
                {canInteract
                  ? 'Toque no botão + abaixo para criar uma tarefa, lista ou nota.'
                  : 'Apenas visualização habilitada.'}
              </p>
            </div>
          ) : (
            <>
              {/* 1. TAREFAS (Largura total, sem bolinhas ou emojis, ordenadas por urgência) */}
              {sortedTasksOnly.length > 0 && (
                <div className="space-y-2">
                  {sortedTasksOnly.map((task) => {
                    const isInProgress = Boolean(task.in_progress_by && !task.completed_at);

                    return (
                      <div
                        key={task.id}
                        onClick={() => openDetailModal(task)}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3.5 shadow-2xs transition active:scale-[0.99] ${
                          isInProgress
                            ? 'border-2 border-amber-300 bg-amber-50/90'
                            : 'border-slate-200/80 bg-white'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {isInProgress && <Zap className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
                            <p
                              className={`truncate text-sm font-semibold ${
                                task.completed_at ? 'line-through text-slate-400' : 'text-slate-800'
                              }`}
                            >
                              {task.title}
                            </p>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Tarefa
                            {task.due_date
                              ? ` • ${new Date(task.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`
                              : ''}
                            {task.assignee ? ` • ${task.assignee.name}` : ''}
                          </p>
                        </div>

                        {canInteract && !task.completed_at && (
                          <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {isInProgress ? (
                              <button
                                type="button"
                                onClick={() => handleTaskAction('stop_progress', task.id)}
                                className="rounded-lg border border-amber-300 bg-white p-1.5 text-amber-700 hover:bg-amber-100"
                                title="Pausar foco"
                              >
                                <Pause className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleTaskAction('start_progress', task.id)}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                <Play className="h-3 w-3" /> Focar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setCompletingTask(task)}
                              className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. LISTAS (Metade da largura da tela: grid-cols-2) */}
              {sortedListsOnly.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5">
                  {sortedListsOnly.map((listItem) => (
                    <div
                      key={listItem.id}
                      onClick={() => openDetailModal(listItem)}
                      className="cursor-pointer rounded-2xl border border-indigo-100 bg-white p-3.5 shadow-2xs transition active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-1.5 text-indigo-600">
                        <ListChecks className="h-3.5 w-3.5 shrink-0" />
                        <p className="truncate text-sm font-semibold text-slate-800">{listItem.title}</p>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Lista • {Array.isArray(listItem.checklist) ? listItem.checklist.length : 0} itens
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* 3. NOTAS (Metade da largura da tela: grid-cols-2) */}
              {sortedNotesOnly.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5">
                  {sortedNotesOnly.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => openDetailModal(note)}
                      className="cursor-pointer rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3.5 shadow-2xs transition active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-1.5 text-amber-700">
                        <StickyNote className="h-3.5 w-3.5 shrink-0" />
                        <p className="truncate text-sm font-semibold text-slate-800">{note.title}</p>
                      </div>
                      <p className="mt-1 text-[11px] text-amber-700/80">Nota</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* MENU FLUTUANTE ACIMA DO BOTÃO (+) */}
          {canInteract && (
            <>
              {fabMenuOpen && (
                <div
                  onClick={() => setFabMenuOpen(false)}
                  className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]"
                />
              )}

              <div className="fixed bottom-20 right-5 z-40 flex flex-col items-end gap-2">
                {fabMenuOpen && (
                  <div className="mb-1 flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFabMenuOpen(false);
                        setInviteModalOpen(true);
                      }}
                      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-lg transition active:scale-95"
                    >
                      <UserPlus className="h-4 w-4 text-slate-700" /> Adicionar Participante
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreateByType('note')}
                      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-lg transition active:scale-95"
                    >
                      <StickyNote className="h-4 w-4 text-slate-700" /> Nova Nota
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreateByType('list')}
                      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-lg transition active:scale-95"
                    >
                      <ListChecks className="h-4 w-4 text-slate-700" /> Nova Lista
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreateByType('task')}
                      className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-lg transition active:scale-95"
                    >
                      <ListTodo className="h-4 w-4 text-slate-700" /> Nova Tarefa
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setFabMenuOpen(!fabMenuOpen)}
                  className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 ${
                    fabMenuOpen
                      ? 'bg-slate-900 shadow-slate-900/30'
                      : 'bg-indigo-600 shadow-indigo-600/30'
                  }`}
                >
                  {fabMenuOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                </button>
              </div>
            </>
          )}

          {/* MODAL DE ADICIONAR PARTICIPANTE */}
          {inviteModalOpen && (
            <div
              onClick={() => setInviteModalOpen(false)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-5 text-center shadow-2xl"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <UserPlus className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Convidar para {house.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Envie o código abaixo para a pessoa entrar neste espaço pela aba "Espaços":
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="font-mono text-base font-bold tracking-wider text-slate-900">
                    {house.invite_code}
                  </span>
                  <button
                    type="button"
                    onClick={copyInviteCode}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="w-full rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-700"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}

          <ItemModal
            isOpen={modalOpen}
            onClose={() => {
              setModalOpen(false);
              setActiveItem(null);
              setCreateType(null);
            }}
            onSave={handleSaveItem}
            onDelete={canInteract ? handleDeleteItem : undefined}
            initialItem={activeItem}
            initialType={createType}
            spaces={spacesWithCurrent}
            defaultSpaceId={Number(id)}
          />

          {completingTask && (
            <div
              onClick={() => setCompletingTask(null)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-5 shadow-xl"
              >
                <h3 className="text-sm font-bold text-slate-900">Concluir: {completingTask.title}</h3>
                <textarea
                  rows={3}
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  placeholder="Alguma observação sobre a conclusão? (Opcional)"
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-indigo-600 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCompletingTask(null)}
                    className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTaskAction('complete', completingTask.id, completionNote)}
                    className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white"
                  >
                    Confirmar Conclusão
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: CHAT */}
      {tab === 'chat' && (
        <div className="flex flex-1 flex-col justify-between p-4">
          <div ref={chatContainerRef} className="space-y-3 overflow-y-auto pb-20">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
                <p className="text-sm font-medium text-slate-600">Chat do espaço vazio</p>
                <p className="mt-1 text-xs text-slate-400">
                  Envie a primeira mensagem para alinhar as atividades com o grupo.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.user_id === user?.id;
                const time = msg.created_at
                  ? new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="mb-1 px-1 text-[10px] font-medium text-slate-400">
                      {msg.sender?.name} • {time}
                    </span>
                    <div
                      className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        isMe
                          ? 'rounded-br-xs bg-indigo-600 text-white'
                          : 'rounded-bl-xs bg-white text-slate-800 shadow-2xs'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {canInteract ? (
            <form
              onSubmit={handleSendMessage}
              className="fixed bottom-16 left-0 right-0 z-20 mx-auto flex max-w-md gap-2 border-t border-slate-200 bg-slate-50 p-3"
            >
              <input
                type="text"
                placeholder="Digite uma mensagem para o espaço..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs focus:border-indigo-600 focus:outline-none"
              />
              <button
                type="submit"
                className="flex items-center justify-center rounded-xl bg-indigo-600 px-4 text-white active:bg-indigo-700"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="fixed bottom-16 left-0 right-0 mx-auto max-w-md bg-amber-50 p-2.5 text-center text-xs text-amber-800">
              Modo Visitante: você pode apenas visualizar o chat.
            </div>
          )}
        </div>
      )}

      {/* ABA 3: DASHBOARD, CÓDIGO DO ESPAÇO E EDIÇÃO COMPLETA */}
      {tab === 'dashboard' && stats && (
        <div className="space-y-4 p-4">
          {/* Código de Convite do Espaço (Movido do Header para o Dashboard) */}
          <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-2xs">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Código do Espaço
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Compartilhe para convidar participantes
              </p>
            </div>
            <button
              type="button"
              onClick={copyInviteCode}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold text-slate-800 active:bg-slate-100"
            >
              #{house.invite_code}
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-slate-400" />
              )}
            </button>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-700">Rendimento da Semana</span>
              <span className="text-indigo-600">{progressPercent}% concluído</span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white p-4 shadow-2xs">
              <p className="text-xs text-slate-500">Pendentes Total</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{stats.pending_total}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-2xs">
              <p className="text-xs text-slate-500">Concluídas (Semana)</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.completed_this_week}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-2xs">
              <p className="text-xs text-slate-500">Prioridade Alta</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{stats.high_priority_pending}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-2xs">
              <p className="text-xs text-slate-500">Vencem na Semana</p>
              <p className="mt-1 text-2xl font-bold text-indigo-600">{stats.due_this_week}</p>
            </div>
          </div>

          {stats.ranking?.length > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-2xs">
              <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Trophy className="h-3.5 w-3.5 text-amber-500" /> Ranking da Semana
              </div>
              <div className="space-y-2">
                {stats.ranking.map((member: any, idx: number) => (
                  <div key={member.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      {idx + 1}º {member.name}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                      {member.completed_week_count} concluídas
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white p-4 shadow-2xs">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              Participantes e Permissões ({house.members.length})
            </h3>
            <div className="space-y-3">
              {house.members.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {m.name} {m.id === user?.id && <span className="text-indigo-600">(Você)</span>}
                    </p>
                    <p className="text-[11px] text-slate-400">{m.email}</p>
                  </div>

                  {isOwner && m.id !== user?.id ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={m.pivot.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium"
                      >
                        <option value="owner">Admin</option>
                        <option value="resident">Membro</option>
                        <option value="guest">Visitante</option>
                      </select>
                      <button
                        onClick={() => handleRemoveMember(m.id, m.name)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Remover participante"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">
                      {m.pivot.role === 'owner' ? 'Admin' : m.pivot.role === 'resident' ? 'Membro' : 'Visitante'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* EDIÇÃO COMPLETA DO ESPAÇO: Ícone, Nome, Descrição e Participantes */}
          {isOwner ? (
            <form onSubmit={handleUpdateHouse} className="space-y-4 rounded-2xl bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Settings className="h-3.5 w-3.5" /> Editar Espaço
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-slate-500">
                  Ícone do Espaço
                </label>
                <div className="grid grid-cols-10 gap-1.5">
                  {SPACE_ICON_OPTIONS.map((opt) => {
                    const IconComp = opt.icon;
                    const active = houseIcon === opt.id;
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => setHouseIcon(opt.id)}
                        title={opt.label}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                          active
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <IconComp className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">
                  Nome do Espaço
                </label>
                <input
                  type="text"
                  required
                  value={houseName}
                  onChange={(e) => setHouseName(e.target.value)}
                  placeholder="Nome do espaço"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">
                  Descrição
                </label>
                <input
                  type="text"
                  value={houseDesc}
                  onChange={(e) => setHouseDesc(e.target.value)}
                  placeholder="Descrição do espaço"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>

              {knownContacts.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-slate-500">
                    Gerenciar Participantes Conhecidos
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {knownContacts.map((person) => {
                      const selected = selectedMemberIds.includes(person.id);
                      return (
                        <button
                          type="button"
                          key={person.id}
                          onClick={() =>
                            setSelectedMemberIds(
                              selected
                                ? selectedMemberIds.filter((mId) => mId !== person.id)
                                : [...selectedMemberIds, person.id]
                            )
                          }
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            selected
                              ? 'bg-indigo-600 text-white'
                              : 'border border-slate-200 bg-slate-50 text-slate-600'
                          }`}
                        >
                          {person.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingHouse}
                  className="flex-1 rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white"
                >
                  {savingHouse ? 'Salvando...' : 'Salvar Alterações'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteHouse}
                  className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600"
                >
                  Excluir Espaço
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={handleLeaveHouse}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 py-3 text-xs font-semibold text-red-600"
            >
              <LogOut className="h-4 w-4" /> Sair deste Espaço
            </button>
          )}
        </div>
      )}
    </div>
  );
};