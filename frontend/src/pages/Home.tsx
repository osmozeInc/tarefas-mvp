import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, KeyRound, Users, CheckSquare } from 'lucide-react';
import api from '../services/api';

interface House {
  id: number;
  name: string;
  description: string | null;
  invite_code: string;
  members_count: number;
  pending_tasks_count: number;
  pivot: { role: string };
}

export const Home: React.FC = () => {
  const [houses, setHouses] = useState<House[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const navigate = useNavigate();

  const loadHouses = async () => {
    const { data } = await api.get('/houses');
    setHouses(data);
  };

  useEffect(() => {
    loadHouses();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/houses', { name, description });
    setName('');
    setDescription('');
    setShowCreate(false);
    loadHouses();
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/houses/join', { invite_code: inviteCode });
    setInviteCode('');
    setShowJoin(false);
    loadHouses();
  };

  return (
    <div className="space-y-4 p-4 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Minhas Residências</h1>
          <p className="text-xs text-slate-500">Toque em um card para abrir o ambiente</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowJoin(!showJoin); setShowCreate(false); }}
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
          >
            <KeyRound className="h-4 w-4" /> Código
          </button>
          <button
            onClick={() => { setShowCreate(!showCreate); setShowJoin(false); }}
            className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Nova
          </button>
        </div>
      </header>

      {showCreate && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Nova Residência</h2>
          <input
            type="text"
            placeholder="Ex: Casa Principal, República..."
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <button type="submit" className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-medium text-white">
            Salvar
          </button>
        </form>
      )}

      {showJoin && (
        <form onSubmit={handleJoin} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Entrar com Código de Convite</h2>
          <input
            type="text"
            placeholder="Digite o código de 8 letras"
            required
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase"
          />
          <button type="submit" className="w-full rounded-xl bg-slate-900 py-2 text-sm font-medium text-white">
            Entrar na Casa
          </button>
        </form>
      )}

      <div className="space-y-3">
        {houses.map((house) => (
          <div
            key={house.id}
            onClick={() => navigate(`/houses/${house.id}`)}
            className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition active:scale-[0.99]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{house.name}</h3>
                {house.description && <p className="text-xs text-slate-500">{house.description}</p>}
              </div>
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold uppercase text-indigo-600">
                {house.pivot.role}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {house.members_count} membros
              </span>
              <span className="flex items-center gap-1 font-medium text-amber-600">
                <CheckSquare className="h-3.5 w-3.5" /> {house.pending_tasks_count} pendentes
              </span>
              <span className="font-mono text-[11px] text-slate-400">#{house.invite_code}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};