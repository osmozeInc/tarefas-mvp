import React from 'react';

export const MeuPainelSkeleton: React.FC = () => (
  <div className="mx-auto max-w-md animate-pulse space-y-5 p-4 pb-28">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="h-7 w-36 rounded-lg bg-slate-200" />
        <div className="h-3 w-44 rounded bg-slate-200" />
      </div>
      <div className="h-9 w-20 rounded-xl bg-slate-200" />
    </div>

    {/* Atalhos dos Espaços */}
    <div className="flex gap-2 overflow-hidden">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-9 w-24 shrink-0 rounded-xl bg-slate-200" />
      ))}
    </div>

    {/* Lista de Tarefas */}
    <div className="space-y-2.5">
      <div className="h-3.5 w-40 rounded bg-slate-200" />
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white p-3.5"
        >
          <div className="space-y-2">
            <div className="h-4 w-44 rounded bg-slate-200" />
            <div className="h-3 w-24 rounded bg-slate-100" />
          </div>
          <div className="flex gap-1.5">
            <div className="h-7 w-14 rounded-lg bg-slate-100" />
            <div className="h-7 w-16 rounded-lg bg-slate-200" />
          </div>
        </div>
      ))}
    </div>

    {/* Grade Listas e Anotações */}
    <div className="space-y-2.5">
      <div className="h-3.5 w-36 rounded bg-slate-200" />
      <div className="grid grid-cols-2 gap-2.5">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-2.5 rounded-2xl border border-slate-200/70 bg-white p-3.5">
            <div className="h-4 w-28 rounded bg-slate-200" />
            <div className="h-3 w-16 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const HouseDetailSkeleton: React.FC = () => (
  <div className="flex min-h-dvh animate-pulse flex-col pb-20">
    {/* Header Branco */}
    <div className="border-b border-slate-200 bg-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between pb-3">
        <div className="h-5 w-16 rounded bg-slate-200" />
        <div className="h-5 w-28 rounded bg-slate-200" />
      </div>
      <div className="flex justify-around border-t border-slate-100 py-3">
        <div className="h-3.5 w-14 rounded bg-slate-200" />
        <div className="h-3.5 w-12 rounded bg-slate-200" />
        <div className="h-3.5 w-20 rounded bg-slate-200" />
      </div>
    </div>

    {/* Busca e Filtros */}
    <div className="space-y-2.5 px-4 pt-3 pb-2">
      <div className="h-9 w-full rounded-xl bg-white" />
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-7 w-16 rounded-full bg-white" />
        ))}
      </div>
    </div>

    {/* Cards */}
    <div className="space-y-2.5 px-4 pt-2">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white p-3.5"
        >
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-slate-200" />
            <div className="h-3 w-28 rounded bg-slate-100" />
          </div>
          <div className="flex gap-1.5">
            <div className="h-7 w-14 rounded-lg bg-slate-100" />
            <div className="h-7 w-16 rounded-lg bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const SpacesListSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-slate-200" />
            <div className="space-y-1.5">
              <div className="h-4 w-28 rounded bg-slate-200" />
              <div className="h-3 w-40 rounded bg-slate-100" />
            </div>
          </div>
          <div className="h-5 w-14 rounded-full bg-slate-100" />
        </div>
        <div className="mt-4 flex justify-between border-t border-slate-100 pt-3">
          <div className="h-3 w-20 rounded bg-slate-100" />
          <div className="h-3 w-20 rounded bg-slate-100" />
          <div className="h-3 w-16 rounded bg-slate-100" />
        </div>
      </div>
    ))}
  </div>
);