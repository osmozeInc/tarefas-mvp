import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Pause, CheckCircle2, Flame, StickyNote, ListTodo, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { cache } from '../services/cache';

export const MeuDia: React.FC = () => {
  // Inicializa IMEDIATAMENTE com o que está no cache (0ms)
  const [jarvisState, setJarvisState] = useState<any>(() => cache.get('meu_dia', null));
  const [syncing, setSyncing] = useState(false);
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'task' | 'priority' | 'note'>('task');
  const [selectedHouseId, setSelectedHouseId] = useState<number | ''>(() => {
    const cached = cache.get<any>('meu_dia', null);
    return cached?.spaces?.[0]?.id || '';
  });
  const [completingTask, setCompletingTask] = useState<any>(null);
  const [completionNote, setCompletionNote] = useState('');
  const navigate = useNavigate();

  const loadState = async (showIndicator = true) => {
    if (showIndicator) setSyncing(true);
    try {
      const response = await api.get('/jarvis/state');
      const data = response.data;
      setJarvisState(data);
      cache.set('meu_dia', data);

      // PRE-WARMING: Abastece o cache de "Meus Espaços" e de cada "HouseDetail" antes do usuário clicar!
      if (data.spaces?.length > 0) {
        cache.set('houses_list', data.spaces);
        if (!selectedHouseId) setSelectedHouseId(data.spaces[0].id);

        data.spaces.forEach((space: any) => {
          cache.set(`house_${space.id}`, space);
          if (data.all_tasks) {
            const spaceTasks = data.all_tasks.filter((t: any) => t.house_id === space.id);
            cache.set(`tasks_${space.id}`, spaceTasks);
          }
        });
      }
    } catch (err) {
      console.error('Erro ao carregar o estado do Jarvis', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadState(false); // Atualiza silenciosamente em segundo plano ao abrir
  }, []);

  // Atualização Otimista: muda na tela em 0ms antes mesmo da API responder
  const handleAction = async (action: string, taskId: number, note?: string) => {
    const previousState = jarvisState;

    if (jarvisState) {
      const allTasks = [
        ...(jarvisState.in_progress || []),
        ...(jarvisState.priorities || []),
        ...(jarvisState.pending_tasks || []),
        ...(jarvisState.notes || []),
      ];
      const target = allTasks.find((t: any) => t.id === taskId);

      const nextState = { ...jarvisState };

      if (action === 'complete') {
        nextState.in_progress = nextState.in_progress?.filter((t: any) => t.id !== taskId);
        nextState.priorities = nextState.priorities?.filter((t: any) => t.id !== taskId);
        nextState.pending_tasks = nextState.pending_tasks?.filter((t: any) => t.id !== taskId);
        nextState.notes = nextState.notes?.filter((t: any) => t.id !== taskId);
      } else if (action === 'start_progress' && target) {
        nextState.in_progress = [{ ...target, in_progress_by: 1 }, ...(nextState.in_progress || []).filter((t: any) => t.id !== taskId)];
      } else if (action === 'stop_progress') {
        nextState.in_progress = nextState.in_progress?.filter((t: any) => t.id !== taskId);
      }

      setJarvisState(nextState);
      cache.set('meu_dia', nextState);
    }

    setCompletingTask(null);
    setCompletionNote('');

    try {
      await api.post('/jarvis/action', {
        action,
        task_id: taskId,
        completion_note: note || undefined,
      });
      loadState(false);
    } catch (err) {
      console.error('Erro ao executar ação, revertendo...', err);
      setJarvisState(previousState);
    }
  };

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const cleanTitle = title.trim();
    const spaceObj = jarvisState?.spaces?.find((s: any) => s.id === Number(selectedHouseId));
    const tempTask = {
      id: Date.now(),
      title: cleanTitle,
      type,
      house_id: Number(selectedHouseId),
      house: spaceObj,
    };

    // Insere na tela em 0ms
    if (jarvisState) {
      const nextState = { ...jarvisState };
      if (type === 'priority') nextState.priorities = [tempTask, ...(nextState.priorities || [])];
      else if (type === 'note') nextState.notes = [tempTask, ...(nextState.notes || [])];
      else nextState.pending_tasks = [tempTask, ...(nextState.pending_tasks || [])];

      setJarvisState(nextState);
      cache.set('meu_dia', nextState);
    }

    setTitle('');
    setShowQuickModal(false);

    try {
      await api.post('/jarvis/action', {
        action: 'create',
        title: cleanTitle,
        type,
        house_id: selectedHouseId ? Number(selectedHouseId) : undefined,
      });
      loadState(false);
    } catch (err) {
      console.error('Erro ao criar item rápido', err);
      loadState(false);
    }
  };

  // Só mostra tela de carregamento na primeiríssima vez na vida em que não há cache nenhum
  if (!jarvisState) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        Carregando dados iniciais...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5 p-4 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Meu Dia</h1>
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
        <button
          onClick={() => setShowQuickModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm active:scale-95"
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
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
              <span>{space.icon || '📂'}</span>
              <span>{space.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* EM ANDAMENTO */}
      {jarvisState?.in_progress?.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            Em Foco Agora
          </h2>
          {jarvisState.in_progress.map((task: any) => (
            <div key={task.id} className="rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="text-lg">{task.house?.icon || '⚡'}</span>
                  <div>
                    <p className="text-sm font-bold text-amber-950">{task.title}</p>
                    <p className="text-[11px] font-medium text-amber-700">
                      {task.house?.name} • Fazendo: {task.doing_user?.name || 'Você'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleAction('stop_progress', task.id)}
                    className="rounded-lg border border-amber-300 bg-white p-1.5 text-amber-700 hover:bg-amber-100"
                    title="Pausar"
                  >
                    <Pause className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setCompletingTask(task)}
                    className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* PRIORIDADES */}
      {jarvisState?.priorities?.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-500">
            <Flame className="h-3.5 w-3.5" /> Prioridades
          </h2>
          {jarvisState.priorities.map((task: any) => (
            <div key={task.id} className="flex items-center justify-between rounded-2xl border border-red-100 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="text-base">{task.house?.icon || '🔥'}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{task.title}</p>
                  <p className="text-[11px] text-slate-400">{task.house?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAction('start_progress', task.id)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Play className="h-3 w-3" /> Focar
                </button>
                <button
                  onClick={() => setCompletingTask(task)}
                  className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                >
                  Feito
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* TAREFAS PENDENTES */}
      {jarvisState?.pending_tasks?.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            <ListTodo className="h-3.5 w-3.5" /> Tarefas do Dia
          </h2>
          {jarvisState.pending_tasks.map((task: any) => (
            <div key={task.id} className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCompletingTask(task)}
                  className="text-slate-300 hover:text-indigo-600"
                >
                  <CheckCircle2 className="h-5 w-5" />
                </button>
                <div>
                  <p className="text-sm font-medium text-slate-800">{task.title}</p>
                  <p className="text-[11px] text-slate-400">{task.house?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAction('start_progress', task.id)}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                  title="Colocar em andamento"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs">
                  {task.house?.icon || '📋'}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* MURAL DE NOTAS RÁPIDAS */}
      {jarvisState?.notes?.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            <StickyNote className="h-3.5 w-3.5" /> Mural de Notas
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {jarvisState.notes.map((note: any) => (
              <div key={note.id} className="flex flex-col justify-between rounded-2xl border border-yellow-200 bg-yellow-50/90 p-3 shadow-2xs">
                <p className="text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">{note.title}</p>
                <div className="mt-3 flex items-center justify-between border-t border-yellow-200/60 pt-2">
                  <span className="text-[11px] font-medium text-yellow-800">
                    {note.house?.icon} {note.house?.name}
                  </span>
                  <button
                    onClick={() => handleAction('complete', note.id)}
                    className="text-[10px] font-semibold text-slate-400 hover:text-slate-700"
                  >
                    Arquivar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ESTADO VAZIO */}
      {!jarvisState?.in_progress?.length &&
        !jarvisState?.priorities?.length &&
        !jarvisState?.pending_tasks?.length &&
        !jarvisState?.notes?.length && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
            <p className="text-sm font-semibold text-slate-700">Tudo limpo no seu dia!</p>
            <p className="mt-1 text-xs text-slate-400">
              Use o botão "+ Adicionar" no topo para registrar tarefas, prioridades ou notas.
            </p>
          </div>
        )}

      {/* MODAL DE CRIAÇÃO RÁPIDA */}
      {showQuickModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-xs">
          <form onSubmit={handleQuickCreate} className="w-full max-w-md space-y-3 rounded-3xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Adicionar ao Jarvis Hub</h3>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'task', label: '📋 Tarefa' },
                { id: 'priority', label: '🔥 Prioridade' },
                { id: 'note', label: '📌 Nota' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setType(item.id as any)}
                  className={`rounded-xl py-2 text-xs font-semibold border transition ${
                    type === item.id
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Espaço / Contexto</label>
              <select
                value={selectedHouseId}
                onChange={(e) => setSelectedHouseId(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium"
              >
                {jarvisState?.spaces?.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.icon} {s.name}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={3}
              required
              placeholder={type === 'note' ? 'Digite sua anotação rápida...' : 'O que precisa ser feito?'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-indigo-600 focus:outline-none"
              autoFocus
            />

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowQuickModal(false)}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE CONCLUSÃO COM NOTA OPCIONAL */}
      {completingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-5 shadow-xl">
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