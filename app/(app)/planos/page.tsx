'use client';
 
/**
 * Tela de planos Premium.
 *
 * Mostra 2 cards lado a lado: Mensal e Anual. Cada um tem features,
 * preco, e botao "Assinar" que chama /api/mp/iniciar-assinatura e
 * redireciona pro init_point do Mercado Pago.
 *
 * Se o user ja eh Premium, redireciona pra /config.
 */
 
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
 
const FEATURES = [
  'Conecte seus bancos com Open Finance',
  'Sincronização automática de transações',
  'Categorização inteligente com IA',
  'Saldo bancário em tempo real',
  'Histórico ilimitado',
];
 
export default function PlanosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState<'mensal' | 'anual' | null>(null);
  const [erro, setErro] = useState('');
 
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
 
      // Se ja eh Premium, manda pro /config
      const { data: perfil } = await supabase
        .from('profiles')
        .select('plano')
        .eq('id', session.user.id)
        .maybeSingle();
 
      if (perfil?.plano === 'premium') {
        router.replace('/config');
        return;
      }
 
      setLoading(false);
    }
    init();
  }, [router]);
 
  async function handleAssinar(plano: 'mensal' | 'anual') {
    setErro('');
    setProcessando(plano);
 
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
        body: JSON.stringify({ plano }),
      });
      const data = await r.json();
 
      if (data.init_point) {
        // Redireciona pro checkout MP
        window.location.href = data.init_point;
      } else {
        setErro(data.erro || 'Nao foi possivel iniciar a assinatura');
        setProcessando(null);
      }
    } catch (e) {
      setErro('Erro de conexao. Tente novamente.');
      setProcessando(null);
    }
  }
 
  if (loading) {
    return (
      <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] flex items-center justify-center">
        <div className="max-w-md mx-auto px-6 w-full">
          <div className="h-8 w-48 rounded bg-[#183e31]/60 animate-pulse mb-8" />
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="h-96 rounded-3xl bg-[#183e31]/60 animate-pulse" />
            <div className="h-96 rounded-3xl bg-[#183e31]/60 animate-pulse" />
          </div>
        </div>
      </main>
    );
  }
 
  return (
    <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] pb-20">
      <div className="max-w-2xl mx-auto px-5">
 
        {/* Cabecalho */}
        <header className="flex items-center justify-between pt-10 pb-6">
          <div>
            <p className="text-xs tracking-widest uppercase font-semibold text-[#7cdbb9]">
              Premium
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
 
        <p className="text-white/60 text-sm mb-8 leading-relaxed">
          Conecte seus bancos, ative a IA financeira e veja tudo em tempo real. 7 dias grátis em ambos os planos.
        </p>
 
        {/* Cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
 
          {/* MENSAL */}
          <div className="rounded-3xl p-6 bg-white/5 border border-white/10 flex flex-col">
            <div className="mb-4">
              <p className="text-xs tracking-widest uppercase font-semibold text-white/40">
                Mensal
              </p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">R$ 39,90</span>
                <span className="text-white/60 text-sm">/mês</span>
              </div>
              <p className="text-white/40 text-xs mt-1">
                7 dias grátis, cancele quando quiser
              </p>
            </div>
 
            <ul className="space-y-2.5 mb-6 flex-1">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#7ad9b7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
 
            <button
              onClick={() => handleAssinar('mensal')}
              disabled={processando !== null}
              className="w-full px-6 py-3 rounded-full text-sm font-bold border border-white/20 text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {processando === 'mensal' ? 'Abrindo checkout...' : 'Assinar mensal'}
            </button>
          </div>
 
          {/* ANUAL (destaque) */}
          <div className="rounded-3xl p-6 bg-[#7ad9b7]/10 border-2 border-[#7ad9b7]/40 flex flex-col relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#7ad9b7] text-[#010302] text-[10px] font-bold uppercase tracking-wider">
              Economize 25%
            </span>
 
            <div className="mb-4">
              <p className="text-xs tracking-widest uppercase font-semibold text-[#7cdbb9]">
                Anual
              </p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">R$ 29,90</span>
                <span className="text-white/60 text-sm">/mês</span>
              </div>
              <p className="text-white/60 text-xs mt-1">
                R$ 358,80 cobrado anualmente
              </p>
              <p className="text-white/40 text-xs">
                7 dias grátis, cancele quando quiser
              </p>
            </div>
 
            <ul className="space-y-2.5 mb-6 flex-1">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#7ad9b7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
 
            <button
              onClick={() => handleAssinar('anual')}
              disabled={processando !== null}
              className="w-full px-6 py-3 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors disabled:opacity-50"
            >
              {processando === 'anual' ? 'Abrindo checkout...' : 'Assinar anual'}
            </button>
          </div>
        </div>
 
        {erro && (
          <div className="rounded-2xl p-4 bg-red-500/10 border border-red-400/20 text-red-200 text-sm text-center mb-6">
            {erro}
          </div>
        )}
 
        {/* Rodape com termos */}
        <div className="text-center text-white/40 text-xs space-y-1">
          <p>Cobrança automática no cartão após o trial.</p>
          <p>Sem fidelidade. Cancele a qualquer momento.</p>
          <p>Processamento seguro pelo Mercado Pago.</p>
        </div>
 
      </div>
    </main>
  );
}