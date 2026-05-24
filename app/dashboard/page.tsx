'use client';
 
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
 
const CORES = ['#7ad9b7', '#7cdbb9', '#3d7d66', '#407c66', '#5a9e82', '#2d5f4d'];
 
type Categoria = { nome: string; valor: number };
type Fatura = {
  total: number;
  categorias: Categoria[];
  insight: string;
  nome_original: string;
  analisado_em: string;
};
 
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
  const [fatura, setFatura] = useState<Fatura | null>(null);
 
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserEmail(user.email || '');
 
      const { data } = await supabase
        .from('faturas')
        .select('total, categorias, insight, nome_original, analisado_em')
        .eq('user_id', user.id)
        .not('analisado_em', 'is', null)
        .order('analisado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
 
      if (data) setFatura(data as Fatura);
      setLoading(false);
    }
    init();
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
 
  const soma = fatura
    ? fatura.categorias.reduce((acc, c) => acc + (c.valor || 0), 0)
    : 0;
 
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
 
        {!fatura && (
          <div className="rounded-3xl p-8 text-center bg-white/5 border border-white/10">
            <p className="text-white text-lg font-bold mb-2">
              Nenhuma fatura analisada ainda
            </p>
            <p className="text-white/60 text-sm mb-6">
              Envie o PDF da sua fatura e a Menta organiza tudo pra voce.
            </p>
            <a
              href="/upload"
              className="inline-block px-6 py-3 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors no-underline"
            >
              Enviar primeira fatura
            </a>
          </div>
        )}
 
        {fatura && (
          <>
            <div
              className="rounded-3xl overflow-hidden relative p-6"
              style={{
                background: 'linear-gradient(155deg, #183e31 0%, #0c2019 60%, #0c1f18 100%)',
                boxShadow: '0 20px 60px -20px rgba(0,0,0,0.5)',
              }}
            >
              <p className="text-xs uppercase tracking-widest font-bold text-[#7cdbb9]">
                Total gasto nesta fatura
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-white/60 text-lg font-medium">R$</span>
                <span className="text-white text-5xl font-bold tracking-tight">
                  {fmtShort(fatura.total)}
                </span>
                <span className="text-white/40 text-2xl font-medium">
                  ,{fmt(fatura.total).split(',')[1]}
                </span>
              </div>
              <p className="text-white/40 text-xs mt-3">
                {fatura.nome_original}
              </p>
            </div>
 
            {fatura.insight && (
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
                      {fatura.insight}
                    </p>
                  </div>
                </div>
              </div>
            )}
 
            <div className="mt-6">
              <h2 className="font-bold text-base text-white mb-3">
                Para onde foi o dinheiro
              </h2>
              <div className="space-y-2">
                {fatura.categorias.map((cat, i) => {
                  const pct = soma > 0 ? (cat.valor / soma) * 100 : 0;
                  return (
                    <div key={i} className="bg-white rounded-2xl p-3" style={{ border: '1px solid #eef2ef' }}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-sm text-[#010302]">{cat.nome}</p>
                        <p className="font-bold text-sm text-[#010302]">R$ {fmt(cat.valor)}</p>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f0f4f1' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: CORES[i % CORES.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
 
      </div>
    </main>
  );
}