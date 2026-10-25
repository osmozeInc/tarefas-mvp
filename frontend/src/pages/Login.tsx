import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const endpoint = isRegister ? '/register' : '/login';
      const payload = isRegister ? { name, email, password } : { email, password };
      const { data } = await api.post(endpoint, payload);
      if (!data?.token || !data?.user) {
        setError('Erro de comunicação com a API (VITE_API_URL incorreta).');
        return;
      }
      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao autenticar. Verifique os dados.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-100 p-6">
      <div className="mx-auto w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Tarefas Casa</h1>
        <p className="mb-6 text-sm text-slate-500">
          {isRegister ? 'Crie sua conta para organizar sua casa' : 'Entre para acessar suas residências'}
        </p>

        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <input
              type="text"
              placeholder="Seu nome"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-600 focus:outline-none"
            />
          )}
          <input
            type="email"
            placeholder="E-mail"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-600 focus:outline-none"
          />
          <input
            type="password"
            placeholder="Senha (mín. 6 caracteres)"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-600 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white active:bg-indigo-700"
          >
            {isRegister ? 'Criar Conta' : 'Entrar'}
          </button>
        </form>

        <button
          onClick={() => setIsRegister(!isRegister)}
          className="mt-4 w-full text-center text-xs font-medium text-indigo-600"
        >
          {isRegister ? 'Já tem conta? Faça login' : 'Não tem conta? Cadastre-se'}
        </button>
      </div>
    </div>
  );
};