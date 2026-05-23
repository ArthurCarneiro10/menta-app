'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const CATEGORIAS = [
  { nome: 'Alimentacao', valor: 743, cor: '#7ad9b7', pct: 28 },
  { nome: 'Compras', valor: 689, cor: '#7cdbb9', pct: 26 },
  { nome: 'Transporte', valor: 412, cor: '#3d7d66', pct: 16 },
  { nome: 'Lazer', valor: 318, cor: '#407c66', pct: 12 },
];

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtShort(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserEmail(user.email || '');
      setLoading(false);
    }
    checkUser();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18]">
        <p className="text-white/60">Carregando...</p>
      </main>
    );
  }

  const investivel = 1280;
  const entrou = 5800;
  const saiu = 2143;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] pb-16">
      <div className="max-w-2xl mx-auto px-5">

        <header className="flex items-center justify-between pt-10 pb-6">
          <div>
            <p className="text-xs tracking-widest uppercase font-semibold text-[#7cdbb9]">
              Bem-vindo
            </p>
            <h1 className="text-2xl font-bold text-white mt-1">
              Menta <span className="text-[#7ad9b7]">App</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/upload"
              className="px-4 py-2 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors no-underline"
            >
              Enviar fatura
            </a>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium border border-white/10 rounded-full hover:bg-white/5 transition-colors"
            >
              Sair
            </button>
          </div>
        </header>

        <p className="text-white/50 text-xs mb-6">
          Conectado como <span className="text-[#7ad9b7]">{userEmail}</span>
        </p>

        <div
          className="rounded-3xl overflow-hidden relative p-6"
          style={{
            background: 'linear-gradient(155deg, #183e31 0%, #0c2019 60%, #0c1f18 100%)',
            boxShadow: '0 20px 60px -20px rgba(0,0,0,0.5)',
          }}
        >
          <p className="text-xs uppercase tracking-widest font-bold text-[#7cdbb9]">
            Disponivel pra investir hoje
          </p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-white/60 text-lg font-medium">R$</span>
            <span className="text-white text-5xl font-bold tracking-tight">
              {fmtShort(investivel)}
            </span>
            <span className="text-white/40 text-2xl font-medium">,00</span>
          </div>

          <button className="mt-5 w-full py-3.5 rounded-2xl font-bold text-sm bg-[#7ad9b7] text-[#010302]">
            Investir agora
          </button>

          <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-white/50 font-semibold">
                Entrou
              </div>
              <p className="text-white font-bold text-lg mt-1">R$ {fmt(entrou)}</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-white/50 font-semibold">
                Saiu
              </div>
              <p className="text-white font-bold text-lg mt-1">R$ {fmt(saiu)}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-3xl p-5 bg-white" style={{ border: '1px solid rgba(122,217,183,0.4)' }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full grid place-items-center flex-shrink-0 bg-[#7ad9b7]/25 text-sm font-bold text-[#3d7d66]">
              IA
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest mb-1 text-[#3d7d66]">
                Insight da IA
              </p>
              <p className="text-sm leading-relaxed text-[#010302]">
                Voce gastou <strong>R$ 2.143 com delivery</strong> esse mes.
                Se reduzir 20%, sobra <strong>R$ 428</strong> pra investir.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="font-bold text-base text-white mb-3">
            Para onde foi o dinheiro
          </h2>
          <div className="space-y-2">
            {CATEGORIAS.map((cat) => (
              <div key={cat.nome} className="bg-white rounded-2xl p-3" style={{ border: '1px solid #eef2ef' }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm text-[#010302]">{cat.nome}</p>
                  <p className="font-bold text-sm text-[#010302]">R$ {fmtShort(cat.valor)}</p>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f0f4f1' }}>
                  <div className="h-full rounded-full" style={{ width: `${cat.pct}%`, background: cat.cor }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-3xl p-5 bg-[#183e31] text-white">
          <p className="text-xs uppercase tracking-widest font-bold text-[#7cdbb9] mb-2">
            Previsao de saldo
          </p>
          <p className="text-base leading-relaxed">
            Se continuar gastando assim, voce termina o mes com{' '}
            <span className="font-bold text-[#7cdbb9]">R$ 1.420 sobrando.</span>
          </p>
        </div>

        <p className="text-center text-white/30 text-xs mt-8">
          Dados de exemplo. Em breve, com base nas suas faturas reais.
        </p>

      </div>
    </main>
  );
}