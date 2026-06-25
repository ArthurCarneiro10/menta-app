'use client';

/**
 * Tela de planos: Free / Premium / Max.
 *
 * 3 cards + toggle Mensal<->Anual. Cada botao pago chama
 * /api/mp/iniciar-assinatura com { nivel, ciclo } e redireciona pro
 * init_point do Mercado Pago.
 *
 * Se o user ja tem plano pago (premium ou max), redireciona pra /config.
 * (Trocar de plano pago pra outro eh uma feature separada, futura.)
 *
 * IMPORTANTE: os precos exibidos aqui sao SO TEXTO e devem bater com o
 * PRECOS de lib/mercadopago.ts. Se mudar la, mude aqui tambem.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Nivel = 'premium' | 'max';
type Ciclo = 'mensal' | 'anual';

// Texto dos precos (deve espelhar PRECOS de lib/mercadopago.ts)
const PRECO_TXT: Record<Nivel, Record<Ciclo, { big: string; suf: string; nota: string }>> = {
  premium: {
    mensal: { big: 'R$ 29,90', suf: '/mês', nota: '' },
    anual: { big: 'R$ 299,00', suf: '/ano', nota: 'equivale a R$ 24,92/mês' },
  },
  max: {
    mensal: { big: 'R$ 49,90', suf: '/mês', nota: '' },
    anual: { big: 'R$ 499,00', suf: '/ano', nota: 'equivale a R$ 41,58/mês' },
  },
};

const PLANOS = [
  {
    id: 'free' as const,
    nome: 'Free',
    descricao: 'Pra começar a organizar.',
    badge: null as string | null,
    destaque: false,
    features: [
      'Análise de até 5 faturas',
      'IA financeira: 5 perguntas a cada 4h',
      'Categorização automática dos gastos',
    ],
  },
  {
    id: 'premium' as const,
    nome: 'Premium',
    descricao: 'Sem limites de análise e IA.',
    badge: null as string | null,
    destaque: false,
    features: [
      'Análise de faturas ilimitada',
      'IA financeira ilimitada',
      'Categorização automática dos gastos',
    ],
  },
  {
    id: 'max' as const,
    nome: 'Max',
    descricao: 'Tudo, com seus bancos conectados.',
    badge: 'Completo',
    destaque: true,
    features: [
      'Tudo do Premium, sem limites',
      'Open Finance: conecte seus bancos',
      'Sincronização automática de transações',
      'Saldo bancário em tempo real',
      'Histórico ilimitado',
    ],
  },
];

function Check() {
  return (
    <svg
      className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#7ad9b7]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function PlanosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ciclo, setCiclo] = useState<Ciclo>('mensal');
  const [processando, setProcessando] = useState<Nivel | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      // Se ja tem plano pago, manda pro /config
      const { data: perfil } = await supabase
        .from('profiles')
        .select('plano')
        .eq('id', session.user.id)
        .maybeSingle();

      if (perfil?.plano === 'premium' || perfil?.plano === 'max') {
        router.replace('/config');
        return;
      }

      setLoading(false);
    }
    init();
  }, [router]);

  async function handleAssinar(nivel: Nivel) {
    setErro('');
    setProcessando(nivel);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const r = await fetch('/api/mp/iniciar-assinatura', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nivel, ciclo }),
      });
      const data = await r.json();

      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        setErro(data.erro || 'Nao foi possivel iniciar a assinatura');
        setProcessando(null);
      }
    } catch {
      setErro('Erro de conexao. Tente novamente.');
      setProcessando(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] flex items-center justify-center">
        <div className="max-w-3xl mx-auto px-6 w-full">
          <div className="h-8 w-48 rounded bg-[#183e31]/60 animate-pulse mb-8" />
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="h-96 rounded-3xl bg-[#183e31]/60 animate-pulse" />
            <div className="h-96 rounded-3xl bg-[#183e31]/60 animate-pulse" />
            <div className="h-96 rounded-3xl bg-[#183e31]/60 animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] pb-20">
      <div className="max-w-3xl mx-auto px-5">

        {/* Cabecalho */}
        <header className="flex items-center justify-between pt-10 pb-6">
          <div>
            <p className="text-xs tracking-widest uppercase font-semibold text-[#7cdbb9]">
              Planos
            </p>
            <h1 className="text-2xl font-bold text-white mt-1">
              Escolha seu <span className="text-[#7ad9b7]">plano</span>
            </h1>
          </div>
          <a
            href="/dashboard"
            className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium border border-white/10 rounded-full hover:bg-white/5 transition-colors no-underline"
          >
            Voltar
          </a>
        </header>

        {/* Toggle Mensal / Anual */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10">
            <button
              onClick={() => setCiclo('mensal')}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                ciclo === 'mensal' ? 'bg-[#7ad9b7] text-[#010302]' : 'text-white/70 hover:text-white'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setCiclo('anual')}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                ciclo === 'anual' ? 'bg-[#7ad9b7] text-[#010302]' : 'text-white/70 hover:text-white'
              }`}
            >
              Anual
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 items-stretch">
          {PLANOS.map((plano) => {
            const ehFree = plano.id === 'free';
            const preco = ehFree ? null : PRECO_TXT[plano.id as Nivel][ciclo];

            return (
              <div
                key={plano.id}
                className={`rounded-3xl p-6 flex flex-col relative ${
                  plano.destaque
                    ? 'bg-[#7ad9b7]/10 border-2 border-[#7ad9b7]/40'
                    : 'bg-white/5 border border-white/10'
                }`}
              >
                {plano.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#7ad9b7] text-[#010302] text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                    {plano.badge}
                  </span>
                )}

                <div className="mb-4">
                  <p className={`text-xs tracking-widest uppercase font-semibold ${
                    plano.destaque ? 'text-[#7cdbb9]' : 'text-white/40'
                  }`}>
                    {plano.nome}
                  </p>

                  <div className="mt-3 flex items-baseline gap-1">
                    {ehFree ? (
                      <span className="text-3xl font-bold text-white">Grátis</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-white">{preco!.big}</span>
                        <span className="text-white/60 text-sm">{preco!.suf}</span>
                      </>
                    )}
                  </div>

                  {!ehFree && preco!.nota && (
                    <p className="text-white/50 text-xs mt-1">{preco!.nota}</p>
                  )}
                  <p className="text-white/50 text-xs mt-1">{plano.descricao}</p>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plano.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                      <Check />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {ehFree ? (
                  <button
                    disabled
                    className="w-full px-6 py-3 rounded-full text-sm font-bold border border-white/10 text-white/40 cursor-default"
                  >
                    Plano atual
                  </button>
                ) : (
                  <button
                    onClick={() => handleAssinar(plano.id as Nivel)}
                    disabled={processando !== null}
                    className={`w-full px-6 py-3 rounded-full text-sm font-bold transition-colors disabled:opacity-50 ${
                      plano.destaque
                        ? 'bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9]'
                        : 'border border-white/20 text-white hover:bg-white/10'
                    }`}
                  >
                    {processando === plano.id ? 'Abrindo checkout...' : `Assinar ${plano.nome}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {erro && (
          <div className="rounded-2xl p-4 bg-red-500/10 border border-red-400/20 text-red-200 text-sm text-center mb-6">
            {erro}
          </div>
        )}

        {/* Rodape */}
        <div className="text-center text-white/40 text-xs space-y-1">
          <p>Cobrança automática no cartão.</p>
          <p>Sem fidelidade. Cancele a qualquer momento.</p>
          <p>Processamento seguro pelo Mercado Pago.</p>
        </div>

      </div>
    </main>
  );
}