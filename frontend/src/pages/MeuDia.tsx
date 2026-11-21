import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Play,
  Pause,
  CheckCircle2,
  ListTodo,
  RefreshCw,
  Calendar,
  Receipt,
  Mail,
  Volume2,
  Sparkles,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import api from '../services/api';
import { cache } from '../services/cache';
import { useAuth } from '../contexts/AuthContext';
import { ItemModal } from '../components/ItemModal';
import { SpaceIcon } from '../components/SpaceIcon';
import { MeuPainelSkeleton } from '../components/Skeletons';

export const MeuDia: React.FC = () => {
  const { isJarvisOwner } = useAuth();
  const [jarvisState, setJarvisState] = useState<any>(() => cache.get('meu_dia', null));
  const [syncing, setSyncing] = useState(false);
  const [briefingExpanded, setBriefingExpanded] = useState(false);
  const [loadingTaskId, setLoadingTaskId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<any | null>(null);

  const [completingTask, setCompletingTask] = useState<any>(null);
  const [completionNote, setCompletionNote] = useState('');

  const navigate = useNavigate();

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const loadState = async (showIndicator = true) => {
    if (showIndicator) setSyncing(true);
    try {
      const response = await api.get('/jarvis/state');
      const data = response.data;
      setJarvisState(data);
      cache.set('meu_dia', data);

      if (data.spaces?.length > 0) {
        cache.set('houses_list', data.spaces);
        data.spaces.forEach((space: any) => {
          cache.set(`house_${space.id}`, space);
          if (data.all_tasks) {
            const spaceTasks = data.all_tasks.filter((t: any) => t.house_id === space.id);
            cache.set(`tasks_${space.id}`, spaceTasks);
          }
        });
      }
    } catch (err: any) {
      if (
        err?.code === 'ERR_CANCELED' ||
        err?.code === 'ECONNABORTED' ||
        err?.message === 'Request aborted'
      ) {
        return;
      }
      console.error('Erro ao carregar o estado do Meu Painel', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadState(false);
  }, []);

  // Ordenação unificada: 1º Em Foco -> 2º Prioridade -> 3º Prazo -> 4º Menos membros -> 5º Nome
  const sortedTasksByPriority = useMemo(() => {
    const rawTasks = [
      ...(jarvisState?.in_progress || []),
      ...(jarvisState?.priorities || []),
      ...(jarvisState?.pending_tasks || []),
    ];

    const uniqueMap = new Map();
    rawTasks.forEach((t: any) => {
      if (t.type !== 'list' && t.type !== 'note') {
        uniqueMap.set(t.id, t);
      }
    });
    const list = Array.from(uniqueMap.values());

    const weight: Record<string, number> = { high: 3, medium: 2, low: 1 };

    return list.sort((a: any, b: any) => {
      const focusA = a.in_progress_by ? 1 : 0;
      const focusB = b.in_progress_by ? 1 : 0;
      if (focusA !== focusB) return focusB - focusA;

      const pA = weight[a.priority] || 2;
      const pB = weight[b.priority] || 2;
      if (pA !== pB) return pB - pA;

      const dA = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const dB = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      if (dA !== dB) return dA - dB;

      const mA = a.house?.members_count ?? 99;
      const mB = b.house?.members_count ?? 99;
      if (mA !== mB) return mA - mB;

      return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR');
    });
  }, [jarvisState]);

  const listsAndNotes = useMemo(() => {
    return [
      ...(jarvisState?.lists || []),
      ...(jarvisState?.notes || []),
    ];
  }, [jarvisState]);

  const handleAction = async (action: string, taskId: number, note?: string) => {
    setCompletingTask(null);
    setCompletionNote('');
    setLoadingTaskId(taskId);
    try {
      await api.post('/jarvis/action', {
        action,
        task_id: taskId,
        completion_note: note || undefined,
      });
      await loadState(false);
    } catch (err) {
      console.error('Erro ao executar ação', err);
    } finally {
      setLoadingTaskId(null);
    }
  };

  const handleSaveItem = async (payload: any) => {
    await api.post('/jarvis/action', payload);
    await loadState(false);
  };

  const handleDeleteItem = async (taskId: number) => {
    await api.post('/jarvis/action', { action: 'delete', task_id: taskId });
    setModalOpen(false);
    setActiveItem(null);
    await loadState(false);
  };

  const openCreateModal = () => {
    setActiveItem(null);
    setModalOpen(true);
  };

  const openDetailModal = (item: any) => {
    setActiveItem(item);
    setModalOpen(true);
  };

  if (!jarvisState) {
    return <MeuPainelSkeleton />;
  }

  const briefing = jarvisState.briefing;
  const hasBriefingData =
    isJarvisOwner &&
    briefing &&
    (briefing.spoken_summary ||
      briefing.calendar_events?.length > 0 ||
      briefing.pending_bills?.length > 0 ||
      briefing.emails_summary?.length > 0);

  return (
    <div className="mx-auto max-w-md space-y-5 p-4 pb-28">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Meu Painel</h1>
            <button
              onClick={() => loadState(true)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
              title="Forçar sincronização"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
          <p className="text-xs capitalize text-slate-500">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {isJarvisOwner && (
          <button
            type="button"
            onClick={() =>
              briefing?.spoken_summary
                ? speakText(briefing.spoken_summary)
                : alert('Jarvis: Aguardando configuração final do assistente.')
            }
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm active:scale-95"
          >
            <Sparkles className="h-4 w-4 text-indigo-400" /> Jarvis
          </button>
        )}
      </header>

      {/* ATALHOS DOS ESPAÇOS */}
      {jarvisState?.spaces?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {jarvisState.spaces.map((space: any) => (
            <button
              key={space.id}
              onClick={() => navigate(`/houses/${space.id}`)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition active:scale-95"
            >
              <SpaceIcon icon={space.icon} className="h-3.5 w-3.5 text-indigo-600" />
              <span>{space.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* BRIEFING MATINAL DO JARVIS */}
      {isJarvisOwner && (
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-md">
          <div
            onClick={() => setBriefingExpanded(!briefingExpanded)}
            className="flex cursor-pointer items-center justify-between p-4 select-none"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                  Briefing do Jarvis
                </p>
                {!briefingExpanded && (
                  <p className="text-[11px] text-slate-400">
                    {hasBriefingData
                      ? 'Toque para expandir agenda, faturas e resumo'
                      : 'Nenhum resumo sincronizado hoje • Toque para ver'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {briefing?.spoken_summary && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speakText(briefing.spoken_summary);
                  }}
                  className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-medium text-indigo-100 hover:bg-white/20"
                >
                  <Volume2 className="h-3.5 w-3.5" /> Ouvir
                </button>
              )}
              {briefingExpanded ? (
                <ChevronUp className="h-4 w-4 text-slate-300" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-300" />
              )}
            </div>
          </div>

          {briefingExpanded && (
            <div className="space-y-3 border-t border-white/10 px-4 pb-4 pt-3">
              {!hasBriefingData ? (
                <p className="text-xs text-slate-400">
                  O Jarvis ainda não enviou o briefing matinal de hoje para a sua conta.
                </p>
              ) : (
                <>
                  {briefing.spoken_summary && (
                    <p className="text-xs leading-relaxed text-slate-200">
                      {briefing.spoken_summary}
                    </p>
                  )}

                  {briefing.calendar_events?.length > 0 && (
                    <div className="space-y-1.5 border-t border-white/10 pt-2.5">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300">
                        <Calendar className="h-3.5 w-3.5" /> Agenda de Hoje
                      </p>
                      {briefing.calendar_events.map((ev: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-slate-100">
                          <span>• {typeof ev === 'string' ? ev : ev.title}</span>
                          {ev.time && (
                            <span className="font-mono text-[11px] text-indigo-200">{ev.time}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {briefing.pending_bills?.length > 0 && (
                    <div className="space-y-1.5 border-t border-white/10 pt-2.5">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                        <Receipt className="h-3.5 w-3.5" /> Faturas & Boletos
                      </p>
                      {briefing.pending_bills.map((bill: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-amber-100">
                          <span>• {typeof bill === 'string' ? bill : bill.title}</span>
                          {bill.amount && (
                            <span className="font-semibold text-amber-300">{bill.amount}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {briefing.emails_summary?.length > 0 && (
                    <div className="space-y-1.5 border-t border-white/10 pt-2.5">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                        <Mail className="h-3.5 w-3.5" /> Destaques do Gmail
                      </p>
                      {briefing.emails_summary.map((mail: any, idx: number) => (
                        <p key={idx} className="truncate text-xs text-slate-200">
                          • {typeof mail === 'string' ? mail : mail.subject}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* TAREFAS POR PRIORIDADE (Com tarefa em foco destacada no topo + borda giratória de loading) */}
      {sortedTasksByPriority.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <ListTodo className="h-3.5 w-3.5" /> Tarefas por Prioridade
          </h2>
          {sortedTasksByPriority.map((task: any) => {
            const isInProgress = Boolean(task.in_progress_by);
            const isLoading = loadingTaskId === task.id;

            const cardContent = (
              <div
                onClick={() => !isLoading && openDetailModal(task)}
                className={`flex cursor-pointer items-center justify-between gap-2 p-3.5 transition active:scale-[0.99] ${
                  isLoading
                    ? 'card-loading-inner bg-white'
                    : isInProgress
                    ? 'rounded-2xl border-2 border-amber-400 bg-amber-50/80 shadow-sm'
                    : 'rounded-2xl border border-slate-200/80 bg-white shadow-2xs'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isInProgress && <Zap className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
                    <p
                      className={`truncate text-sm font-semibold ${
                        isInProgress ? 'text-amber-950' : 'text-slate-800'
                      }`}
                    >
                      {task.title}
                    </p>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-indigo-600">
                    <SpaceIcon icon={task.house?.icon} className="h-3 w-3 shrink-0" />
                    <span className="truncate">{task.house?.name}</span>
                  </p>
                </div>

                <div
                  className="flex shrink-0 items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isInProgress ? (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleAction('stop_progress', task.id)}
                      className="rounded-lg border border-amber-300 bg-white p-1.5 text-amber-700 hover:bg-amber-100 disabled:opacity-40"
                      title="Pausar foco"
                    >
                      <Pause className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleAction('start_progress', task.id)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      title="Focar nesta tarefa"
                    >
                      <Play className="h-3 w-3" /> Focar
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setCompletingTask(task)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                      isInProgress
                        ? 'bg-amber-600 text-white hover:bg-amber-700'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                    title="Concluir tarefa"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                  </button>
                </div>
              </div>
            );

            return isLoading ? (
              <div key={task.id} className="card-loading-wrap shadow-sm">
                {cardContent}
              </div>
            ) : (
              <React.Fragment key={task.id}>{cardContent}</React.Fragment>
            );
          })}
        </section>
      )}

      {/* SEÇÃO UNIFICADA: LISTAS E ANOTAÇÕES */}
      {listsAndNotes.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <ListChecks className="h-3.5 w-3.5" /> Listas e Anotações
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {listsAndNotes.map((item: any) => {
              const isNote = item.type === 'note';
              return (
                <div
                  key={item.id}
                  onClick={() => openDetailModal(item)}
                  className={`cursor-pointer rounded-2xl border p-3.5 shadow-2xs transition active:scale-[0.99] ${
                    isNote
                      ? 'border-yellow-200 bg-yellow-50/90'
                      : 'border-indigo-100 bg-white'
                  }`}
                >
                  <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-indigo-600">
                    <SpaceIcon icon={item.house?.icon} className="h-3 w-3 shrink-0" />
                    <span className="truncate">{item.house?.name}</span>
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!hasBriefingData &&
        sortedTasksByPriority.length === 0 &&
        listsAndNotes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
            <p className="text-sm font-semibold text-slate-700">Tudo limpo no seu painel!</p>
            <p className="mt-1 text-xs text-slate-400">
              Toque no botão + abaixo para criar tarefas, listas ou notas.
            </p>
          </div>
        )}

      <button
        type="button"
        onClick={openCreateModal}
        title="Adicionar Tarefa, Lista ou Nota"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom)*0.55)] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      <ItemModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setActiveItem(null);
        }}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
        initialItem={activeItem}
        spaces={jarvisState?.spaces || []}
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
                onClick={() => handleAction('complete', completingTask.id, completionNote)}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white"
              >
                Confirmar Conclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};