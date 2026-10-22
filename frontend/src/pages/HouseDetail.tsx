import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Send,
  CheckCircle2,
  Circle,
  Trash2,
  Pencil,
  Calendar,
  Copy,
  Check,
  UserMinus,
  Settings,
  Repeat,
  Search,
  Trophy,
  LogOut,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export const HouseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<'tasks' | 'chat' | 'dashboard'>('tasks');
  const [filter, setFilter] = useState<'all' | 'mine' | 'pending' | 'future' | 'done'>('pending');
  const [search, setSearch] = useState('');
  const [house, setHouse] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Estado do Modal de Tarefa (Criar / Editar)
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [mentionedIds, setMentionedIds] = useState<number[]>([]);

  // Estado de Edição da Residência (Dono)
  const [houseName, setHouseName] = useState('');
  const [houseDesc, setHouseDesc] = useState('');
  const [savingHouse, setSavingHouse] = useState(false);

  // Estado do Chat
  const [chatInput, setChatInput] = useState('');

  const myRole = house?.members?.find((m: any) => m.id === user?.id)?.pivot?.role || 'guest';
  const canInteract = myRole === 'owner' || myRole === 'resident';
  const isOwner = myRole === 'owner';

  const loadData = async () => {
    const [houseRes, tasksRes, statsRes] = await Promise.all([
      api.get(`/houses/${id}`),
      api.get(`/houses/${id}/tasks`),
      api.get(`/houses/${id}/dashboard`),
    ]);
    setHouse(houseRes.data);
    setHouseName(houseRes.data.name);
    setHouseDesc(houseRes.data.description || '');
    setTasks(tasksRes.data);
    setStats(statsRes.data);
  };

  const loadMessages = async () => {
    const { data } = await api.get(`/houses/${id}/messages`);
    setMessages(data);
  };

  useEffect(() => {
    loadData();
    loadMessages();
  }, [id]);

  useEffect(() => {
    if (tab !== 'chat') return;
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    const interval = setInterval(loadMessages, 4000);
    return () => clearInterval(interval);
  }, [tab, id, messages.length]);

  const copyInviteCode = () => {
    if (!house?.invite_code) return;
    navigator.clipboard.writeText(house.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setRecurrence('none');
    setDueDate('');
    setAssignedTo('');
    setMentionedIds([]);
    setShowTaskModal(true);
  };

  const openEditModal = (task: any) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setRecurrence(task.recurrence || 'none');
    setDueDate(task.due_date ? task.due_date.substring(0, 10) : '');
    setAssignedTo(task.assigned_to ? String(task.assigned_to) : '');
    setMentionedIds(task.mentioned_users ? task.mentioned_users.map((u: any) => u.id) : []);
    setShowTaskModal(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title,
      description: description.trim() || null,
      priority,
      recurrence,
      due_date: dueDate || null,
      assigned_to: assignedTo ? Number(assignedTo) : null,
      mentioned_user_ids: mentionedIds,
    };

    if (editingTask) {
      await api.put(`/houses/${id}/tasks/${editingTask.id}`, payload);
    } else {
      await api.post(`/houses/${id}/tasks`, payload);
    }

    setShowTaskModal(false);
    loadData();
  };

  const toggleTask = async (taskId: number) => {
    if (!canInteract) return;
    await api.patch(`/houses/${id}/tasks/${taskId}/toggle`);
    loadData();
  };

  const deleteTask = async (taskId: number) => {
    if (!window.confirm('Excluir esta tarefa?')) return;
    await api.delete(`/houses/${id}/tasks/${taskId}`);
    loadData();
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
    loadData();
  };

  const handleRemoveMember = async (memberId: number, memberName: string) => {
    if (!window.confirm(`Remover ${memberName} desta residência?`)) return;
    await api.delete(`/houses/${id}/members/${memberId}`);
    loadData();
  };

  const handleLeaveHouse = async () => {
    if (!window.confirm('Deseja sair desta residência?')) return;
    await api.post(`/houses/${id}/leave`);
    navigate('/');
  };

  const handleUpdateHouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHouse(true);
    try {
      await api.put(`/houses/${id}`, { name: houseName, description: houseDesc });
      await loadData();
    } finally {
      setSavingHouse(false);
    }
  };

  const handleDeleteHouse = async () => {
    if (!window.confirm('Tem certeza que deseja excluir esta residência e todas as suas tarefas?')) return;
    await api.delete(`/houses/${id}`);
    navigate('/');
  };

  if (!house) return <div className="p-8 text-center text-sm text-slate-500">Carregando residência...</div>;

const today = new Date();
  today.setHours(23, 59, 59, 999);

  const filteredTasks = tasks.filter((t) => {
    const isFuture = t.due_date && new Date(t.due_date) > today;

    if (filter === 'mine' && t.assigned_to !== user?.id) return false;
    
    if (filter === 'pending') {
      if (t.completed_at) return false;
      if (isFuture) return false; // Oculta tarefas da próxima repetição do painel principal
    }
    
    if (filter === 'future') {
      if (t.completed_at || !isFuture) return false; // Mostra apenas o que está no futuro
    }
    
    if (filter === 'done' && !t.completed_at) return false;
    if (search.trim() && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const priorityBadge = (p: string) => {
    if (p === 'high') return { label: 'Alta', cls: 'bg-red-50 text-red-600 border-red-200' };
    if (p === 'low') return { label: 'Baixa', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
    return { label: 'Média', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  };

  const recurrenceLabel: Record<string, string> = {
    daily: 'Diária',
    weekly: 'Semanal',
    monthly: 'Mensal',
  };

  const totalWeekTasks = (stats?.completed_this_week || 0) + (stats?.pending_total || 0);
  const progressPercent = totalWeekTasks > 0 ? Math.round((stats.completed_this_week / totalWeekTasks) * 100) : 0;

  return (
    <div className="flex min-h-screen flex-col pb-20">
      {/* Header + Abas */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 pt-3 backdrop-blur-md">
        <div className="flex items-center justify-between pb-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div className="flex flex-col items-end">
            <h1 className="text-sm font-bold text-slate-900">{house.name}</h1>
            <button
              onClick={copyInviteCode}
              className="mt-0.5 flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600 active:bg-slate-200"
            >
              #{house.invite_code}
              {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-slate-400" />}
            </button>
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
              {t === 'tasks' ? `Tarefas (${tasks.filter((i) => !i.completed_at).length})` : t === 'chat' ? 'Chat' : 'Dashboard'}
            </button>
          ))}
        </div>
      </div>

      {/* ABA 1: TAREFAS */}
      {tab === 'tasks' && (
        <div className="space-y-3 p-4">
          {/* Busca Rápida */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar tarefa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-indigo-600 focus:outline-none"
            />
          </div>

          {/* Barra de Filtros Rápidos */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'mine', label: 'Para Mim' },
              { id: 'pending', label: 'Atuais' },
              { id: 'future', label: 'Futuras' },
              { id: 'done', label: 'Concluídas' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  filter === f.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 shadow-2xs'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
              <p className="text-sm font-medium text-slate-600">Nenhuma tarefa encontrada</p>
              <p className="mt-1 text-xs text-slate-400">
                {canInteract ? 'Toque no botão + abaixo para criar uma nova tarefa.' : 'Apenas visualização habilitada.'}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const badge = priorityBadge(task.priority);
              const isOverdue = task.due_date && !task.completed_at && new Date(task.due_date) < new Date();

              return (
                <div key={task.id} className="rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-1 items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        disabled={!canInteract}
                        className="mt-0.5 text-slate-300 transition active:scale-90"
                      >
                        {task.completed_at ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <Circle className="h-5 w-5 hover:text-indigo-500" />
                        )}
                      </button>

                      <div className="flex-1">
                        <p
                          className={`text-sm font-semibold ${
                            task.completed_at ? 'line-through text-slate-400' : 'text-slate-800'
                          }`}
                        >
                          {task.title}
                        </p>

                        {task.description && (
                          <p className="mt-1 text-xs text-slate-500 leading-relaxed">{task.description}</p>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className={`rounded-md border px-1.5 py-0.5 font-semibold ${badge.cls}`}>
                            {badge.label}
                          </span>

                          {task.recurrence && task.recurrence !== 'none' && (
                            <span className="flex items-center gap-1 rounded-md bg-teal-50 px-1.5 py-0.5 font-medium text-teal-700">
                              <Repeat className="h-3 w-3" />
                              {recurrenceLabel[task.recurrence]}
                            </span>
                          )}

                          {task.due_date && (
                            <span
                              className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium ${
                                isOverdue ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <Calendar className="h-3 w-3" />
                              {new Date(task.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                            </span>
                          )}

                          {task.assignee && (
                            <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-700">
                              Resp: {task.assignee.name}
                            </span>
                          )}

                          {task.mentioned_users?.map((m: any) => (
                            <span key={m.id} className="rounded-md bg-purple-50 px-1.5 py-0.5 font-medium text-purple-700">
                              @{m.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {canInteract && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(task)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Botão FAB Mobile */}
          {canInteract && (
            <button
              onClick={openCreateModal}
              className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition active:scale-95"
            >
              <Plus className="h-6 w-6" />
            </button>
          )}

          {/* Modal Criar / Editar Tarefa */}
          {showTaskModal && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-xs">
              <form
                onSubmit={handleSaveTask}
                className="w-full max-w-md space-y-3 rounded-3xl bg-white p-5 shadow-xl"
              >
                <h3 className="text-base font-bold text-slate-900">
                  {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
                </h3>

                <input
                  type="text"
                  placeholder="Título da tarefa (ex: Tirar o lixo)"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-600 focus:outline-none"
                />

                <textarea
                  placeholder="Descrição ou observações (opcional)"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-600 focus:outline-none"
                />

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">Prioridade</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">Repetição</label>
                    <select
                      value={recurrence}
                      onChange={(e) => setRecurrence(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"
                    >
                      <option value="none">Não repete</option>
                      <option value="daily">Diária</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">Prazo</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Responsável principal</label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">Qualquer morador (Sem responsável fixo)</option>
                    {house.members.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-slate-500">
                    Mencionar moradores (Envia alerta Push):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {house.members.map((m: any) => {
                      const selected = mentionedIds.includes(m.id);
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() =>
                            setMentionedIds(
                              selected ? mentionedIds.filter((i) => i !== m.id) : [...mentionedIds, m.id]
                            )
                          }
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          @{m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTaskModal(false)}
                    className="flex-1 rounded-xl bg-slate-100 py-3 text-xs font-semibold text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-semibold text-white"
                  >
                    {editingTask ? 'Salvar Alterações' : 'Criar Tarefa'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: CHAT */}
      {tab === 'chat' && (
        <div className="flex flex-1 flex-col justify-between p-4">
          <div className="space-y-3 overflow-y-auto pb-20">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
                <p className="text-sm font-medium text-slate-600">Chat da residência vazio</p>
                <p className="mt-1 text-xs text-slate-400">Envie a primeira mensagem para alinhar as tarefas com o grupo.</p>
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
            <div ref={chatEndRef} />
          </div>

          {canInteract ? (
            <form
              onSubmit={handleSendMessage}
              className="fixed bottom-16 left-0 right-0 z-20 mx-auto flex max-w-md gap-2 border-t border-slate-200 bg-slate-50 p-3"
            >
              <input
                type="text"
                placeholder="Digite uma mensagem para a casa..."
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

      {/* ABA 3: DASHBOARD SEMANAL E GESTÃO DE MEMBROS */}
      {tab === 'dashboard' && stats && (
        <div className="space-y-4 p-4">
          {/* Barra de Progresso da Semana */}
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

          {/* Ranking de Produtividade da Semana */}
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

          {/* Lista de Membros e Controle de Acesso */}
          <div className="rounded-2xl bg-white p-4 shadow-2xs">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              Moradores e Permissões ({house.members.length})
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
                        <option value="owner">Dono</option>
                        <option value="resident">Morador</option>
                        <option value="guest">Visitante</option>
                      </select>
                      <button
                        onClick={() => handleRemoveMember(m.id, m.name)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Remover morador"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">
                      {m.pivot.role === 'owner' ? 'Dono' : m.pivot.role === 'resident' ? 'Morador' : 'Visitante'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Configurações Exclusivas do Dono ou Botão de Sair para Morador/Visitante */}
          {isOwner ? (
            <form onSubmit={handleUpdateHouse} className="space-y-3 rounded-2xl bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Settings className="h-3.5 w-3.5" /> Configurações da Residência
              </div>
              <input
                type="text"
                required
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
                placeholder="Nome da residência"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={houseDesc}
                onChange={(e) => setHouseDesc(e.target.value)}
                placeholder="Descrição da casa"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingHouse}
                  className="flex-1 rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white"
                >
                  {savingHouse ? 'Salvando...' : 'Salvar Dados'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteHouse}
                  className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600"
                >
                  Excluir Casa
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={handleLeaveHouse}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 py-3 text-xs font-semibold text-red-600"
            >
              <LogOut className="h-4 w-4" /> Sair desta Residência
            </button>
          )}
        </div>
      )}
    </div>
  );
};