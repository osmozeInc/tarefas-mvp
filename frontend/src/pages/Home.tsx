import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cache } from '../services/cache';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, CheckSquare, X, GripVertical } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { SpacesListSkeleton } from '../components/Skeletons';
import { SpaceIcon, SPACE_ICON_OPTIONS } from '../components/SpaceIcon';

interface House {
  id: number;
  name: string;
  description: string | null;
  icon?: string | null;
  invite_code: string;
  members_count: number;
  pending_tasks_count: number;
  members?: { id: number; name: string; email: string }[];
  pivot: { role: string; position?: number };
}

export const Home: React.FC = () => {
  const { user } = useAuth();
  const [houses, setHouses] = useState<House[]>(() => cache.get('houses_list', []));
  const [loading, setLoading] = useState(() => cache.get('houses_list', []).length === 0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'create' | 'join'>('create');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('folder');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);

  const [inviteCode, setInviteCode] = useState('');
  const [notifyEntry, setNotifyEntry] = useState(true);

  // Controle de Drag & Drop (funciona com toque/segurar no celular e mouse no PC)
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const housesRef = useRef<House[]>(houses);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const holdTimerRef = useRef<number | null>(null);
  const startYRef = useRef(0);
  const wasDraggingRef = useRef(false);
  const orderChangedRef = useRef(false);

  const navigate = useNavigate();

  useEffect(() => {
    housesRef.current = houses;
  }, [houses]);

  const loadHouses = async () => {
    try {
      const { data } = await api.get('/jarvis/state');
      if (data?.spaces) {
        setHouses(data.spaces);
        cache.set('houses_list', data.spaces);
        cache.set('meu_dia', data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHouses();
  }, []);

  // Listeners globais enquanto um card está sendo arrastado
  useEffect(() => {
    if (draggingId === null) return;

    const handleMove = (clientY: number) => {
      const currentList = [...housesRef.current];
      const draggedIndex = currentList.findIndex((h) => h.id === draggingId);
      if (draggedIndex === -1) return;

      for (let i = 0; i < currentList.length; i++) {
        if (i === draggedIndex) continue;
        const el = cardRefs.current[currentList[i].id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if ((i < draggedIndex && clientY < midY) || (i > draggedIndex && clientY > midY)) {
          const [moved] = currentList.splice(draggedIndex, 1);
          currentList.splice(i, 0, moved);
          housesRef.current = currentList;
          orderChangedRef.current = true;
          setHouses(currentList);
          break;
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      handleMove(e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        e.preventDefault(); // Evita rolar a página no iOS enquanto arrasta o espaço
        handleMove(e.touches[0].clientY);
      }
    };

    const finishDrag = async () => {
      setDraggingId(null);
      setTimeout(() => {
        wasDraggingRef.current = false;
      }, 100);

      if (orderChangedRef.current) {
        orderChangedRef.current = false;
        const ordered = housesRef.current;
        cache.set('houses_list', ordered);
        const cachedMeuDia = cache.get<any>('meu_dia', null);
        if (cachedMeuDia) {
          cache.set('meu_dia', { ...cachedMeuDia, spaces: ordered });
        }

        try {
          await api.post('/jarvis/action', {
            action: 'reorder_spaces',
            space_ids: ordered.map((h) => h.id),
          });
        } catch (err) {
          console.error('Erro ao salvar ordem dos espaços', err);
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [draggingId]);

  const startDragImmediate = (houseId: number) => {
    wasDraggingRef.current = true;
    orderChangedRef.current = false;
    if (navigator.vibrate) navigator.vibrate(15);
    setDraggingId(houseId);
  };

  const handleCardPointerDown = (houseId: number, e: React.PointerEvent) => {
    startYRef.current = e.clientY;
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      startDragImmediate(houseId);
    }, 240);
  };

  const handleCardPointerMoveBeforeDrag = (e: React.PointerEvent) => {
    if (draggingId !== null || !holdTimerRef.current) return;
    if (Math.abs(e.clientY - startYRef.current) > 8) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const cancelHoldTimer = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const knownContacts = useMemo(() => {
    const map = new Map<number, { id: number; name: string; email: string }>();
    houses.forEach((h) => {
      h.members?.forEach((m) => {
        if (m.id !== user?.id) map.set(m.id, m);
      });
    });
    return Array.from(map.values());
  }, [houses, user?.id]);

  const openModal = () => {
    setErrorMsg('');
    setName('');
    setDescription('');
    setIcon('folder');
    setSelectedMemberIds([]);
    setInviteCode('');
    setNotifyEntry(true);
    setModalTab('create');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg('');
    setSubmitting(true);

    try {
      if (modalTab === 'create') {
        await api.post('/jarvis/action', {
          action: 'create_space',
          name: name.trim(),
          description: description.trim() || null,
          icon,
          member_ids: selectedMemberIds,
        });
      } else {
        await api.post('/jarvis/action', {
          action: 'join_space',
          invite_code: inviteCode.trim(),
          notify_entry: notifyEntry,
        });
      }
      setModalOpen(false);
      await loadHouses();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Não foi possível concluir a operação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 p-4 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Meus Espaços</h1>
          <p className="text-xs text-slate-500">
            Segure e arraste um card para reordenar
          </p>
        </div>

        <button
          onClick={openModal}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition active:scale-95"
        >
          <Plus className="h-4 w-4" /> Espaço
        </button>
      </header>

      {loading ? (
        <SpacesListSkeleton />
      ) : (
        <div className="space-y-3 select-none">
          {houses.map((house) => {
            const isDragging = draggingId === house.id;
            return (
              <div
                key={house.id}
                ref={(el) => {
                  cardRefs.current[house.id] = el;
                }}
                onPointerDown={(e) => handleCardPointerDown(house.id, e)}
                onPointerMove={handleCardPointerMoveBeforeDrag}
                onPointerUp={cancelHoldTimer}
                onPointerCancel={cancelHoldTimer}
                onClick={() => {
                  if (wasDraggingRef.current) return;
                  navigate(`/houses/${house.id}`);
                }}
                className={`cursor-pointer rounded-2xl border bg-white p-4 transition-all ${
                  isDragging
                    ? 'z-20 scale-[1.02] border-indigo-500 shadow-xl ring-2 ring-indigo-500/20'
                    : 'border-slate-200/80 shadow-sm active:scale-[0.99]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        cancelHoldTimer();
                        startDragImmediate(house.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 -ml-1 touch-none cursor-grab p-1 text-slate-300 hover:text-slate-500 active:cursor-grabbing"
                      title="Arrastar para reordenar"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-700">
                      <SpaceIcon icon={house.icon} className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{house.name}</h3>
                      {house.description && (
                        <p className="text-xs text-slate-500">{house.description}</p>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold uppercase text-indigo-600">
                    {house.pivot?.role === 'owner' ? 'Admin' : 'Membro'}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {house.members_count} participantes
                  </span>
                  <span className="flex items-center gap-1 font-medium text-amber-600">
                    <CheckSquare className="h-3.5 w-3.5" /> {house.pending_tasks_count} pendentes
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">#{house.invite_code}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-xs"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="flex max-h-[88dvh] w-full max-w-md flex-col rounded-3xl bg-white p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Adicionar Espaço</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setModalTab('create');
                  setErrorMsg('');
                }}
                className={`rounded-xl py-2 text-xs font-semibold transition ${
                  modalTab === 'create' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Criar Espaço
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalTab('join');
                  setErrorMsg('');
                }}
                className={`rounded-xl py-2 text-xs font-semibold transition ${
                  modalTab === 'join' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Entrar com Código
              </button>
            </div>

            {errorMsg && (
              <div className="mb-3 rounded-xl bg-red-50 p-2.5 text-xs font-medium text-red-600">
                {errorMsg}
              </div>
            )}

            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {modalTab === 'create' ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-slate-500">
                      Ícone do Espaço
                    </label>
                    <div className="grid grid-cols-10 gap-1.5">
                      {SPACE_ICON_OPTIONS.map((opt) => {
                        const IconComp = opt.icon;
                        const active = icon === opt.id;
                        return (
                          <button
                            type="button"
                            key={opt.id}
                            onClick={() => setIcon(opt.id)}
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
                      placeholder="Ex: Projetos, Estudos, Equipe..."
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">
                      Descrição (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Objetivo ou contexto deste espaço"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs focus:border-indigo-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-slate-500">
                      Adicionar Participantes Conhecidos
                    </label>
                    {knownContacts.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-400">
                        Suas conexões e amigos aparecerão aqui para adição rápida.
                      </p>
                    ) : (
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
                                    ? selectedMemberIds.filter((id) => id !== person.id)
                                    : [...selectedMemberIds, person.id]
                                )
                              }
                              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                selected
                                  ? 'bg-indigo-600 text-white'
                                  : 'border border-slate-200 bg-slate-50 text-slate-700'
                              }`}
                            >
                              {person.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">
                      Código de Convite
                    </label>
                    <input
                      type="text"
                      placeholder="Digite o código de 8 caracteres"
                      required
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-sm uppercase focus:border-indigo-600 focus:outline-none"
                    />
                  </div>

                  <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={notifyEntry}
                      onChange={(e) => setNotifyEntry(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    />
                    <span>Notificar entrada aos participantes do espaço</span>
                  </label>
                </>
              )}
            </div>

            <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-xs font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-semibold text-white disabled:opacity-50"
              >
                {submitting
                  ? 'Aguarde...'
                  : modalTab === 'create'
                  ? 'Salvar Espaço'
                  : 'Entrar no Espaço'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};