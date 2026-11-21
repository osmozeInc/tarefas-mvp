import React, { useEffect, useRef, useState } from 'react';
import { SpaceIcon } from './SpaceIcon';
import {
  Plus,
  Trash2,
  X,
  CheckSquare,
  Square,
  ListOrdered,
  List,
  CheckCircle2,
  FileText,
  Pencil,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  hideCheck?: boolean;
}

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
  onDelete?: (taskId: number) => Promise<void>;
  onUncomplete?: (taskId: number) => Promise<void>;
  initialItem?: any | null;
  initialType?: 'task' | 'list' | 'note' | null;
  spaces: any[];
  defaultSpaceId?: number | '';
}

const STANDARD_RECURRENCES = ['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'yearly'];

export function formatRecurrenceLabel(rec?: string | null): string {
  if (!rec || rec === 'none') return 'Não repete';
  const map: Record<string, string> = {
    daily: 'Diária',
    weekdays: 'Seg a Sex (Dias úteis)',
    weekly: 'Semanal',
    biweekly: 'Quinzenal (15 dias)',
    monthly: 'Mensal',
    yearly: 'Anual',
  };
  if (map[rec]) return map[rec];

  if (rec.startsWith('custom:')) {
    const [, interval, unit] = rec.split(':');
    const unitLabel = unit === 'weeks' ? 'semanas' : unit === 'months' ? 'meses' : 'dias';
    return `A cada ${interval} ${unitLabel}`;
  }
  return rec;
}

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  onUncomplete,
  initialItem,
  initialType = null,
  spaces,
  defaultSpaceId,
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('edit');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reopening, setReopening] = useState(false);

  const [type, setType] = useState<'task' | 'list' | 'note'>('task');
  const [houseId, setHouseId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const [recurrence, setRecurrence] = useState<string>('none');
  const [customInterval, setCustomInterval] = useState<number>(2);
  const [customUnit, setCustomUnit] = useState<'days' | 'weeks' | 'months'>('days');

  const [dueDate, setDueDate] = useState('');
  const [assignedIds, setAssignedIds] = useState<number[]>([]);
  const [mentionedIds, setMentionedIds] = useState<number[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newStepText, setNewStepText] = useState('');

  const [listMode, setListMode] = useState<'checklist' | 'items'>('checklist');
  const [isNumbered, setIsNumbered] = useState(false);
  const [notifyMembers, setNotifyMembers] = useState(false);
  const [saving, setSaving] = useState(false);

  const submitLockRef = useRef(false);

  const isCompleted = Boolean(initialItem?.completed_at);

  useEffect(() => {
    if (!isOpen) {
      submitLockRef.current = false;
      setConfirmDeleteOpen(false);
      setDeleting(false);
      setReopening(false);
      return;
    }

    if (initialItem) {
      setMode('view');
      const normalizedType =
        initialItem.type === 'list' ? 'list' : initialItem.type === 'note' ? 'note' : 'task';
      setType(normalizedType);
      setHouseId(initialItem.house_id || defaultSpaceId || spaces[0]?.id || '');
      setTitle(initialItem.title || '');
      setDescription(initialItem.description || '');
      setPriority(initialItem.priority || 'medium');

      const savedRec = initialItem.recurrence || 'none';
      if (savedRec.startsWith('custom:')) {
        const [, interval, unit] = savedRec.split(':');
        setRecurrence('custom');
        setCustomInterval(Number(interval) || 2);
        setCustomUnit((unit as any) || 'days');
      } else if (STANDARD_RECURRENCES.includes(savedRec)) {
        setRecurrence(savedRec);
      } else {
        setRecurrence('none');
      }

      setDueDate(initialItem.due_date ? String(initialItem.due_date).substring(0, 10) : '');

      if (Array.isArray(initialItem.assignees) && initialItem.assignees.length > 0) {
        setAssignedIds(initialItem.assignees.map((u: any) => u.id));
      } else if (initialItem.assigned_to) {
        setAssignedIds([Number(initialItem.assigned_to)]);
      } else {
        setAssignedIds([]);
      }

      setMentionedIds(
        initialItem.mentioned_users ? initialItem.mentioned_users.map((u: any) => u.id) : []
      );
      const savedList = Array.isArray(initialItem.checklist) ? initialItem.checklist : [];
      setChecklist(savedList);
      setListMode(savedList.length > 0 && savedList[0]?.hideCheck ? 'items' : 'checklist');
      setIsNumbered(Boolean(initialItem.is_numbered));
      setNotifyMembers(false);
    } else {
      setMode('edit');
      setType(initialType || 'task');
      setHouseId(defaultSpaceId || spaces[0]?.id || '');
      setTitle('');
      setDescription('');
      setPriority('medium');
      setRecurrence('none');
      setCustomInterval(2);
      setCustomUnit('days');
      setDueDate('');
      setAssignedIds([]);
      setMentionedIds([]);
      setChecklist([]);
      setListMode('checklist');
      setIsNumbered(false);
      setNotifyMembers(false);
    }
    setNewStepText('');
  }, [isOpen, initialItem, initialType, defaultSpaceId, spaces]);

  if (!isOpen) return null;

  const currentSpace =
    spaces.find((s: any) => s.id === Number(houseId)) || initialItem?.house || spaces[0];
  const members: any[] = currentSpace?.members || [];

  const handleAddStep = () => {
    if (!newStepText.trim()) return;
    setChecklist((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random()}`,
        text: newStepText.trim(),
        done: false,
        hideCheck: type === 'list' && listMode === 'items',
      },
    ]);
    setNewStepText('');
  };

  const toggleStep = async (stepId: string) => {
    if (isCompleted) return;
    if (type === 'list' && listMode === 'items') return;
    const updated = checklist.map((item) =>
      item.id === stepId ? { ...item, done: !item.done } : item
    );
    setChecklist(updated);

    if (mode === 'view' && initialItem?.id) {
      try {
        await onSave({
          action: 'update',
          task_id: initialItem.id,
          house_id: Number(houseId),
          checklist: updated,
        });
      } catch {
        // Silencioso
      }
    }
  };

  const removeStep = (stepId: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== stepId));
  };

  const handleConfirmDelete = async () => {
    if (!initialItem?.id || !onDelete || deleting) return;
    setDeleting(true);
    try {
      await onDelete(initialItem.id);
      setConfirmDeleteOpen(false);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const handleUncomplete = async () => {
    if (!initialItem?.id || !onUncomplete || reopening) return;
    setReopening(true);
    try {
      await onUncomplete(initialItem.id);
      onClose();
    } finally {
      setReopening(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompleted) return;
    if (!title.trim() || submitLockRef.current || saving) return;

    submitLockRef.current = true;
    setSaving(true);

    let finalChecklist = [...checklist];
    if (newStepText.trim()) {
      finalChecklist.push({
        id: `${Date.now()}_${Math.random()}`,
        text: newStepText.trim(),
        done: false,
      });
    }

    if (type === 'list') {
      finalChecklist = finalChecklist.map((item) => ({
        ...item,
        hideCheck: listMode === 'items',
        done: listMode === 'items' ? false : item.done,
      }));
    }

    const finalRecurrence =
      type === 'task'
        ? recurrence === 'custom'
          ? `custom:${Math.max(1, customInterval)}:${customUnit}`
          : recurrence
        : 'none';

    try {
      await onSave({
        action: initialItem ? 'update' : 'create',
        task_id: initialItem?.id,
        house_id: Number(houseId),
        type,
        title: title.trim(),
        description: type !== 'list' ? description.trim() || null : null,
        priority: type === 'task' ? priority : 'medium',
        recurrence: finalRecurrence,
        due_date: type === 'task' && dueDate ? dueDate : null,
        assigned_to: type === 'task' ? (assignedIds[0] ?? null) : null,
        assigned_to_ids: type === 'task' ? assignedIds : [],
        mentioned_user_ids: type === 'task' ? mentionedIds : [],
        checklist: type !== 'note' ? finalChecklist : [],
        is_numbered: type === 'list' ? isNumbered : false,
        notify_members: type !== 'task' ? notifyMembers : false,
      });
      onClose();
    } finally {
      submitLockRef.current = false;
      setSaving(false);
    }
  };

  const priorityText = (p: string) => {
    if (p === 'high') return 'Alta';
    if (p === 'low') return 'Baixa';
    return 'Média';
  };

  const assignedObjects =
    initialItem?.assignees?.length > 0
      ? initialItem.assignees
      : members.filter((m: any) => assignedIds.includes(m.id));
  const mentionedObjects = members.filter((m: any) => mentionedIds.includes(m.id));
  const recLabel = formatRecurrenceLabel(
    recurrence === 'custom' ? `custom:${customInterval}:${customUnit}` : recurrence
  );

  const modalTitle = initialItem
    ? 'Editar Registro'
    : initialType === 'list'
    ? 'Nova Lista'
    : initialType === 'note'
    ? 'Nova Nota'
    : initialType === 'task'
    ? 'Nova Tarefa'
    : 'Novo Registro';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs"
    >
      {/* ==================== MODO 1: VISUALIZAÇÃO LIMPA ==================== */}
      {mode === 'view' && initialItem ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex min-h-[75dvh] max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-white p-5 shadow-2xl"
        >
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              {type === 'list'
                ? 'Detalhes da Lista'
                : type === 'note'
                ? 'Detalhes da Nota'
                : 'Detalhes da Tarefa'}
            </h3>

            <div className="flex items-center gap-1.5">
              {/* Tarefas concluídas NÃO podem ser editadas; exibem botão de Reabrir */}
              {isCompleted ? (
                onUncomplete && (
                  <button
                    type="button"
                    disabled={reopening}
                    onClick={handleUncomplete}
                    className="flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {reopening ? 'Reabrindo...' : 'Reabrir'}
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
              )}

              {onDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="flex items-center gap-1 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {/* Registro de Conclusão (quando concluída) */}
            {isCompleted && (
              <div className="space-y-1.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                <p className="text-xs font-bold text-emerald-800">Tarefa Concluída</p>
                <p className="text-xs text-emerald-900">
                  Concluída por:{' '}
                  <strong>
                    {initialItem.completer?.nickname ||
                      initialItem.completer?.name ||
                      'Não registrado'}
                  </strong>{' '}
                  em {new Date(initialItem.completed_at).toLocaleDateString('pt-BR')}
                </p>
                {initialItem.completion_note && (
                  <p className="pt-1 text-xs text-emerald-800 whitespace-pre-wrap">
                    Observação: {initialItem.completion_note}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
              <div>
                <span className="block text-[11px] font-medium text-slate-400">Espaço</span>
                <p className="mt-0.5 text-sm font-medium text-slate-800">
                  <span className="inline-flex items-center gap-1.5">
                    <SpaceIcon icon={currentSpace?.icon} className="h-3.5 w-3.5 text-slate-600" />
                    <span>{currentSpace?.name || '—'}</span>
                  </span>
                </p>
              </div>
              <div>
                <span className="block text-[11px] font-medium text-slate-400">Tipo</span>
                <p className="mt-0.5 text-sm font-medium text-slate-800">
                  {type === 'list' ? 'Lista' : type === 'note' ? 'Nota' : 'Tarefa'}
                </p>
              </div>
            </div>

            <div className="border-b border-slate-100 pb-3">
              <span className="block text-[11px] font-medium text-slate-400">Título</span>
              <p className="mt-0.5 text-base font-semibold text-slate-900">{title}</p>
            </div>

            {type === 'task' && (
              <>
                <div className="border-b border-slate-100 pb-3">
                  <span className="block text-[11px] font-medium text-slate-400">Descrição</span>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {description || 'Sem descrição.'}
                  </p>
                </div>

                {checklist.length > 0 && (
                  <div className="space-y-2 border-b border-slate-100 pb-3">
                    <span className="block text-[11px] font-medium text-slate-400">
                      Etapas / Checklist
                    </span>
                    <div className="space-y-1.5">
                      {checklist.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => toggleStep(item.id)}
                          className={`flex items-center gap-2.5 py-1 text-sm ${
                            isCompleted ? 'opacity-75' : 'cursor-pointer hover:opacity-80'
                          }`}
                        >
                          {item.done ? (
                            <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600" />
                          ) : (
                            <Square className="h-4 w-4 shrink-0 text-slate-400" />
                          )}
                          <span className={item.done ? 'line-through text-slate-400' : 'text-slate-800'}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <span className="block text-[11px] font-medium text-slate-400">Prioridade</span>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">
                      {priorityText(priority)}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-400">Repetição</span>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">{recLabel}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <span className="block text-[11px] font-medium text-slate-400">Responsáveis</span>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">
                      {assignedObjects.length > 0
                        ? assignedObjects.map((m: any) => m.name).join(', ')
                        : 'Qualquer pessoa'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-400">Prazo</span>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">
                      {dueDate
                        ? new Date(dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                        : 'Sem prazo'}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] font-medium text-slate-400">
                    Participantes mencionados
                  </span>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">
                    {mentionedObjects.length > 0
                      ? mentionedObjects.map((m: any) => m.name).join(', ')
                      : 'Nenhum participante mencionado'}
                  </p>
                </div>
              </>
            )}

            {type === 'list' && (
              <>
                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <span className="block text-[11px] font-medium text-slate-400">Formato</span>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">
                      {listMode === 'items' ? 'Apenas Itens' : 'Checklist'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-400">Numeração</span>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">
                      {isNumbered ? 'Numerada' : 'Não numerada'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="block text-[11px] font-medium text-slate-400">Itens da Lista</span>
                  {checklist.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum item adicionado.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {checklist.map((item, idx) => (
                        <div
                          key={item.id}
                          onClick={() => toggleStep(item.id)}
                          className={`flex items-center gap-2.5 border-b border-slate-100 py-2 text-sm ${
                            listMode === 'items' || isCompleted
                              ? ''
                              : 'cursor-pointer hover:opacity-80'
                          }`}
                        >
                          {listMode === 'items' ? (
                            <span className="font-semibold text-slate-500">
                              {isNumbered ? `${idx + 1}.` : '•'}
                            </span>
                          ) : item.done ? (
                            <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600" />
                          ) : (
                            <Square className="h-4 w-4 shrink-0 text-slate-400" />
                          )}
                          <span className={item.done ? 'line-through text-slate-400' : 'text-slate-800'}>
                            {listMode === 'checklist' && isNumbered ? `${idx + 1}. ` : ''}
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {type === 'note' && (
              <div>
                <span className="block text-[11px] font-medium text-slate-400">Descrição da Nota</span>
                <p className="mt-1 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {description || 'Sem conteúdo.'}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==================== MODO 2: FORMULÁRIO DE CRIAÇÃO / EDIÇÃO ==================== */
        <form
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSubmit}
          className="flex min-h-[75dvh] max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-white p-5 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">{modalTitle}</h3>
            <div className="flex items-center gap-2">
              {initialItem && onDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="flex items-center gap-1 rounded-xl bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {!initialType && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'task', label: 'Tarefa' },
                  { id: 'list', label: 'Lista' },
                  { id: 'note', label: 'Nota' },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setType(item.id as any)}
                    className={`rounded-xl border py-2 text-xs font-semibold transition ${
                      type === item.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Espaço</label>
              <select
                value={houseId}
                onChange={(e) => {
                  setHouseId(Number(e.target.value));
                  setAssignedIds([]);
                  setMentionedIds([]);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium"
              >
                {spaces.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Título</label>
              <input
                type="text"
                required
                placeholder={
                  type === 'task'
                    ? 'Título da tarefa...'
                    : type === 'list'
                    ? 'Título da lista...'
                    : 'Título da nota...'
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium focus:border-indigo-600 focus:outline-none"
              />
            </div>

            {type === 'task' && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">
                    Descrição (Opcional)
                  </label>
                  <textarea
                    placeholder="Detalhes, links ou observações da tarefa..."
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs leading-relaxed focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Etapas / Checklist (Opcional)
                  </label>

                  {checklist.length > 0 && (
                    <div className="space-y-1.5">
                      {checklist.map((step) => (
                        <div
                          key={step.id}
                          className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 shadow-2xs"
                        >
                          <button
                            type="button"
                            onClick={() => toggleStep(step.id)}
                            className="flex flex-1 items-center gap-2 text-left text-xs"
                          >
                            {step.done ? (
                              <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <Square className="h-4 w-4 shrink-0 text-slate-400" />
                            )}
                            <span className={step.done ? 'line-through text-slate-400' : 'text-slate-700'}>
                              {step.text}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStep(step.id)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Adicionar etapa..."
                      value={newStepText}
                      onChange={(e) => setNewStepText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddStep();
                        }
                      }}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-indigo-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                    >
                      <Plus className="h-3.5 w-3.5" /> Etapa
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">Prioridade</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs"
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
                      onChange={(e) => setRecurrence(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs"
                    >
                      <option value="none">Não repete</option>
                      <option value="daily">Diária</option>
                      <option value="weekdays">Seg a Sex (Dias úteis)</option>
                      <option value="weekly">Semanal</option>
                      <option value="biweekly">Quinzenal (15 dias)</option>
                      <option value="monthly">Mensal</option>
                      <option value="yearly">Anual</option>
                      <option value="custom">Personalizada...</option>
                    </select>
                  </div>
                </div>

                {recurrence === 'custom' && (
                  <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3">
                    <span className="text-xs font-medium text-slate-700">Repetir a cada</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={customInterval}
                      onChange={(e) => setCustomInterval(Number(e.target.value) || 1)}
                      className="w-16 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-center text-xs font-semibold"
                    />
                    <select
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value as any)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium"
                    >
                      <option value="days">Dias</option>
                      <option value="weeks">Semanas</option>
                      <option value="months">Meses</option>
                    </select>
                  </div>
                )}

                {/* Prazo */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[11px] font-medium text-slate-500">Prazo (Opcional)</label>
                    {dueDate && (
                      <button
                        type="button"
                        onClick={() => setDueDate('')}
                        className="text-[10px] font-semibold text-red-500 hover:underline"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                  />
                </div>

                {/* Múltiplos Responsáveis */}
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-slate-500">
                    Responsáveis (Selecione um ou mais; nenhum = Qualquer pessoa):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAssignedIds([])}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        assignedIds.length === 0
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Qualquer pessoa
                    </button>
                    {members.map((m: any) => {
                      const selected = assignedIds.includes(m.id);
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() =>
                            setAssignedIds(
                              selected
                                ? assignedIds.filter((i) => i !== m.id)
                                : [...assignedIds, m.id]
                            )
                          }
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Menções */}
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-slate-500">
                    Mencionar participantes (Envia alerta Push):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m: any) => {
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
              </>
            )}

            {type === 'list' && (
              <>
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                      Formato da Lista
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setListMode('checklist')}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition ${
                          listMode === 'checklist'
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Checklist
                      </button>
                      <button
                        type="button"
                        onClick={() => setListMode('items')}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition ${
                          listMode === 'items'
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <FileText className="h-3.5 w-3.5" /> Apenas Itens
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/70 pt-2.5">
                    <span className="text-[11px] font-semibold text-slate-600">Numeração</span>
                    <div className="flex gap-1 rounded-xl bg-slate-200/70 p-0.5">
                      <button
                        type="button"
                        onClick={() => setIsNumbered(false)}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition ${
                          !isNumbered ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                        }`}
                      >
                        <List className="h-3 w-3" /> Não numerada
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsNumbered(true)}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition ${
                          isNumbered ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                        }`}
                      >
                        <ListOrdered className="h-3 w-3" /> Numerada
                      </button>
                    </div>
                  </div>

                  {checklist.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {checklist.map((item, idx) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 shadow-2xs"
                        >
                          {listMode === 'checklist' ? (
                            <button
                              type="button"
                              onClick={() => toggleStep(item.id)}
                              className="flex flex-1 items-center gap-2 text-left text-xs"
                            >
                              {item.done ? (
                                <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600" />
                              ) : (
                                <Square className="h-4 w-4 shrink-0 text-slate-400" />
                              )}
                              <span className={item.done ? 'line-through text-slate-400' : 'text-slate-800'}>
                                {isNumbered ? `${idx + 1}. ` : ''}
                                {item.text}
                              </span>
                            </button>
                          ) : (
                            <div className="flex flex-1 items-center gap-2 text-left text-xs text-slate-800">
                              <span className="font-semibold text-indigo-600">
                                {isNumbered ? `${idx + 1}.` : '•'}
                              </span>
                              <span>{item.text}</span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeStep(item.id)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Adicionar item à lista..."
                      value={newStepText}
                      onChange={(e) => setNewStepText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddStep();
                        }
                      }}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-indigo-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                    >
                      <Plus className="h-3.5 w-3.5" /> Item
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={notifyMembers}
                    onChange={(e) => setNotifyMembers(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  <span>
                    Notificar participantes do espaço que esta lista foi {initialItem ? 'editada' : 'criada'}
                  </span>
                </label>
              </>
            )}

            {type === 'note' && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Descrição da Nota</label>
                  <textarea
                    placeholder="Escreva o conteúdo completo da nota..."
                    rows={6}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs leading-relaxed focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={notifyMembers}
                    onChange={(e) => setNotifyMembers(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  <span>
                    Notificar participantes do espaço que esta nota foi {initialItem ? 'editada' : 'criada'}
                  </span>
                </label>
              </>
            )}
          </div>

          <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => (initialItem ? setMode('view') : onClose())}
              className="flex-1 rounded-xl bg-slate-100 py-3 text-xs font-semibold text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Salvando...' : initialItem ? 'Salvar Alterações' : 'Criar'}
            </button>
          </div>
        </form>
      )}

      {/* MODAL PRÓPRIO DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {confirmDeleteOpen && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDeleteOpen(false);
          }}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs space-y-4 rounded-3xl bg-white p-5 text-center shadow-2xl"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Excluir este registro?</h4>
              <p className="mt-1 text-xs text-slate-500">
                Tem certeza que deseja excluir permanentemente <strong>"{title}"</strong>?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};