import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth, THEME_OPTIONS, applyThemeColor } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [themeColor, setThemeColor] = useState('orange');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleThemeSelect = (colorId: string) => {
    setThemeColor(colorId);
    applyThemeColor(colorId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegister && password !== passwordConfirmation) {
      setError('A confirmação de senha não confere.');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = isRegister ? '/register' : '/login';
      const payload = isRegister
        ? {
            name: name.trim(),
            nickname: nickname.trim(),
            phone: phone.trim(),
            email: email.trim(),
            password,
            password_confirmation: passwordConfirmation,
            theme_color: themeColor,
          }
        : { email: email.trim(), password };

      const { data } = await api.post(endpoint, payload);
      if (!data?.token || !data?.user) {
        setError('Erro de comunicação com a API.');
        return;
      }
      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      const firstValidationError = err.response?.data?.errors
        ? (Object.values(err.response.data.errors)[0] as string[])[0]
        : null;
      setError(
        firstValidationError ||
          err.response?.data?.message ||
          'Erro ao autenticar. Verifique os dados informados.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-slate-100 p-6">
      <div className="mx-auto w-full max-w-sm rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Jarvis Hub</h1>
        <p className="mb-5 text-xs text-slate-500">
          {isRegister
            ? 'Preencha seus dados e escolha sua cor de preferência'
            : 'Entre para acessar seu painel e seus espaços'}
        </p>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">
                    Apelido *
                  </label>
                  <input
                    type="text"
                    placeholder="Como prefere ser chamado"
                    required
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">
                    Celular *
                  </label>
                  <input
                    type="tel"
                    placeholder="(88) 99999-9999"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">E-mail *</label>
            <input
              type="email"
              placeholder="seu@email.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div className={isRegister ? 'grid grid-cols-2 gap-2.5' : ''}>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Senha *</label>
              <input
                type="password"
                placeholder="Mín. 6 caracteres"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs focus:border-indigo-600 focus:outline-none"
              />
            </div>

            {isRegister && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">
                  Confirmar Senha *
                </label>
                <input
                  type="password"
                  placeholder="Repita a senha"
                  required
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs focus:border-indigo-600 focus:outline-none"
                />
              </div>
            )}
          </div>

          {isRegister && (
            <div className="pt-1">
              <label className="mb-1.5 block text-[11px] font-medium text-slate-500">
                Cor de Preferência do Ambiente
              </label>
              <div className="grid grid-cols-6 gap-2">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleThemeSelect(t.id)}
                    title={t.label}
                    className={`flex h-9 items-center justify-center rounded-xl border-2 transition ${
                      themeColor === t.id ? 'border-slate-900 scale-105' : 'border-transparent opacity-75'
                    }`}
                    style={{ backgroundColor: t.hex }}
                  />
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-xl bg-indigo-600 py-3 text-xs font-semibold text-white transition active:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Processando...' : isRegister ? 'Criar Conta' : 'Entrar'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setIsRegister(!isRegister);
            setError('');
          }}
          className="mt-4 w-full text-center text-xs font-semibold text-indigo-600"
        >
          {isRegister ? 'Já tem conta? Faça login' : 'Não tem conta? Cadastre-se'}
        </button>
      </div>
    </div>
  );
};