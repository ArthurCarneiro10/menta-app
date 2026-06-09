'use client';
 
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getOuCriaPerfil } from '@/lib/perfil';
import SinoNotificacoes from '@/components/SinoNotificacoes';
import OnboardingModal from '@/components/OnboardingModal';
 
const CORES = ['#7ad9b7', '#7cdbb9', '#3d7d66', '#407c66', '#5a9e82', '#2d5f4d'];
 
const CARD_GRADIENT_STYLE = {
  background: 'linear-gradient(155deg, #183e31 0%, #0c2019 60%, #0c1f18 100%)',
  boxShadow: '0 20px 60px -20px rgba(0,0,0,0.5)',
};
 
type Categoria = { nome: string; valor: number };
type Fatura = {
  total: number;
  categorias: Categoria[];
  insight: string;
  nome_original: string;
  analisado_em: string;
};
type Transacao = {
  valor: number | string | null;
  tipo: string | null;
  categoria: string | null;
};
type ContaBancaria = {
  tipo: string | null;
  saldo: number | string | null;
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
  const [userId, setUserId] = useState('');
  const [nome, setNome] = useState('');
  const [plano, setPlano] = useState<'free' | 'premium'>('free');
 
  const [fatura, setFatura] = useState<Fatura | null>(null);
 
  const [temConexao, setTemConexao] = useState(false);
  const [totalBanco, setTotalBanco] = useState(0);
  const [categoriasBanco, setCategoriasBanco] = useState<Categoria[]>([]);
  const [temTxRecente, setTemTxRecente] = useState(false);
 
  const [saldoBancario, setSaldoBancario] = useState(0);
  const [numContasBancarias, setNumContasBancarias] = useState(0);
 
  const [temFaturasAntigas, setTemFaturasAntigas] = useState(false);
 
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);
 
      const perfil = await getOuCriaPerfil(user.id);
      const nomeBase = perfil?.nome || (user.email ? user.email.split('@')[0] : 'voce');
      setNome(nomeBase);
 
      const ehPremium = perfil?.plano === 'premium';
      setPlano(ehPremium ? 'premium' : 'free');
 
      const { count: fatCount } = await supabase
        .from('faturas')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('analisado_em', 'is', null);
      const temPDFs = (fatCount || 0) > 0;
      setTemFaturasAntigas(temPDFs);
 
      if (ehPremium) {
        const { count: connCount } = await supabase
          .from('connections')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        const conectado = (connCount || 0) > 0;
        setTemConexao(conectado);
 
        if (conectado) {
          const { data: contasData } = await supabase
            .from('contas_bancarias')
            .select('saldo, tipo')
            .eq('user_id', user.id);
 
          const bankComSaldo: ContaBancaria[] = (contasData || []).filter(
            (c: ContaBancaria) => c.tipo === 'BANK' && c.saldo !== null
          );
          const saldoTotal = bankComSaldo.reduce(
            (acc, c) => acc + Number(c.saldo || 0),
            0
          );
          setSaldoBancario(saldoTotal);
          setNumContasBancarias(bankComSaldo.length);
 
          const trinta = new Date();
          trinta.setDate(trinta.getDate() - 30);
          const limite = trinta.toISOString().slice(0, 10);
 
          const { data: txs } = await supabase
            .from('transacoes_banco')
            .select('valor, tipo, categoria')
            .eq('user_id', user.id)
            .gte('data', limite);
 
          const debits: Transacao[] = (txs || []).filter((t: Transacao) => t.tipo === 'DEBIT');
 
          if (debits.length > 0) {
            setTemTxRecente(true);
 
            let total = 0;
            const mapa = new Map<string, number>();
            for (const t of debits) {
              const v = Math.abs(Number(t.valor || 0));
              total += v;
              const cat = (t.categoria || 'Outros').trim() || 'Outros';
              mapa.set(cat, (mapa.get(cat) || 0) + v);
            }
 
            setTotalBanco(total);
            const cats = Array.from(mapa.entries())
              .map(([nome, valor]) => ({ nome, valor }))
              .sort((a, b) => b.valor - a.valor);
            setCategoriasBanco(cats);
          }
        }
      } else {
        const { data } = await supabase
          .from('faturas')
          .select('total, categorias, insight, nome_original, analisado_em')
          .eq('user_id', user.id)
          .not('analisado_em', 'is', null)
          .order('analisado_em', { ascending: false })
          .limit(1)
          .maybeSingle();
 
        if (data) setFatura(data as Fatura);
      }
 
      setLoading(false);
    }
    init();
  }, [router]);
 
  if (loading) {
    // Skeleton: replica grosseiramente o layout (header + cards + lista de categorias)
    // pra que a transicao pro conteudo real seja suave, sem reflow.
    return (
      <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18]">
        <div className="max-w-md mx-auto px-6 pt-12 pb-32">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div className="space-y-2">
              <div className="h-3 w-20 rounded bg-[#183e31]/60 animate-pulse" />
              <div className="h-7 w-48 rounded bg-[#183e31]/60 animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-28 rounded-full bg-[#183e31]/60 animate-pulse" />
              <div className="h-10 w-10 rounded-full bg-[#183e31]/60 animate-pulse" />
            </div>
          </div>
 
          {/* Cards do topo (saldo + gasto ou total + insight) */}
          <div className="grid sm:grid-cols-2 gap-3 mb-8">
            <div className="h-28 rounded-2xl bg-[#183e31]/60 animate-pulse" />
            <div className="h-28 rounded-2xl bg-[#183e31]/60 animate-pulse" />
          </div>
 
          {/* Titulo da secao */}
          <div className="h-5 w-48 rounded bg-[#183e31]/60 animate-pulse mb-4" />
 
          {/* Lista de categorias */}
          <div className="space-y-3">
            <div className="h-16 rounded-2xl bg-[#183e31]/60 animate-pulse" />
            <div className="h-16 rounded-2xl bg-[#183e31]/60 animate-pulse" />
            <div className="h-16 rounded-2xl bg-[#183e31]/60 animate-pulse" />
            <div className="h-16 rounded-2xl bg-[#183e31]/60 animate-pulse" />
          </div>
        </div>
      </main>
    );
  }
 
  const ctaHeader =
    plano === 'premium'
      ? { href: '/conectar', label: temConexao ? 'Banco' : 'Conectar banco' }
      : { href: '/upload', label: 'Enviar fatura' };
 
  const somaFatura = fatura
    ? fatura.categorias.reduce((acc, c) => acc + (c.valor || 0), 0)
    : 0;
 
  const saldoNegativo = saldoBancario < 0;
  const saldoAbs = Math.abs(saldoBancario);
 
  // Flags pra decidir o layout do bloco hero
  const temSaldoCard = plano === 'premium' && temConexao && numContasBancarias > 0;
  const temGastoCard = plano === 'premium' && temTxRecente;
 
  return (
    <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] pb-16">
      <OnboardingModal />
      <div className="max-w-2xl mx-auto px-5">
 
        <header className="flex items-center justify-between pt-10 pb-6">
          <div className="flex items-center gap-3">
            <a
              href="/config"
              aria-label="Configurações"
              className="w-10 h-10 grid place-items-center rounded-full border border-white/10 text-white/80 hover:text-white hover:bg-white/5 transition-colors no-underline shrink-0"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </a>
            <div>
              <img
                src="/menta-logo.png"
                alt="Menta"
                className="h-5 w-auto object-contain opacity-70 mb-1.5"
              />
              <h1 className="text-2xl font-bold text-white">
                Oi, <span className="text-[#7ad9b7]">{nome}</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={ctaHeader.href}
              className="px-4 py-2 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors no-underline"
            >
              {ctaHeader.label}
            </a>
            <SinoNotificacoes userId={userId} />
          </div>
        </header>
 
        {/* =========== HERO BLOCO: Saldo + Gasto lado a lado (sm:cols-2) =========== */}
        {temSaldoCard && temGastoCard && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {/* Saldo */}
            <div
              className="rounded-3xl overflow-hidden relative p-5"
              style={CARD_GRADIENT_STYLE}
            >
              <p className="text-xs uppercase tracking-widest font-bold text-[#7cdbb9]">
                Saldo em contas
              </p>
              <div className="flex items-baseline gap-1 mt-2 flex-wrap">
                <span className="text-white/60 text-base font-medium">R$</span>
                <span
                  className={`text-3xl font-bold tracking-tight ${
                    saldoNegativo ? 'text-red-300' : 'text-white'
                  }`}
                >
                  {saldoNegativo ? '-' : ''}
                  {fmtShort(saldoAbs)}
                </span>
                <span className="text-white/40 text-base font-medium">
                  ,{fmt(saldoAbs).split(',')[1]}
                </span>
              </div>
              <p className="text-[11px] text-white/40 mt-1">
                {numContasBancarias} conta{numContasBancarias !== 1 ? 's' : ''} bancária
                {numContasBancarias !== 1 ? 's' : ''}
              </p>
            </div>
 
            {/* Gasto */}
            <div
              className="rounded-3xl overflow-hidden relative p-5"
              style={CARD_GRADIENT_STYLE}
            >
              <p className="text-xs uppercase tracking-widest font-bold text-[#7cdbb9]">
                Gasto · últimos 30 dias
              </p>
              <div className="flex items-baseline gap-1 mt-2 flex-wrap">
                <span className="text-white/60 text-base font-medium">R$</span>
                <span className="text-white text-3xl font-bold tracking-tight">
                  {fmtShort(totalBanco)}
                </span>
                <span className="text-white/40 text-base font-medium">
                  ,{fmt(totalBanco).split(',')[1]}
                </span>
              </div>
            </div>
          </div>
        )}
 
        {/* Saldo SOLO (sem gasto recente) - mantem comportamento original */}
        {temSaldoCard && !temGastoCard && (
          <div className="rounded-3xl p-5 mb-4" style={CARD_GRADIENT_STYLE}>
            <p className="text-xs uppercase tracking-widest font-bold text-[#7cdbb9]">
              Saldo em contas
            </p>
            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
              <span className="text-white/60 text-base font-medium">R$</span>
              <span
                className={`text-3xl font-bold tracking-tight ${
                  saldoNegativo ? 'text-red-300' : 'text-white'
                }`}
              >
                {saldoNegativo ? '-' : ''}
                {fmtShort(saldoAbs)}
              </span>
              <span className="text-white/40 text-lg font-medium">
                ,{fmt(saldoAbs).split(',')[1]}
              </span>
            </div>
            <p className="text-xs text-white/40 mt-1">
              {numContasBancarias} conta{numContasBancarias !== 1 ? 's' : ''} bancária
              {numContasBancarias !== 1 ? 's' : ''} conectada
              {numContasBancarias !== 1 ? 's' : ''}
            </p>
          </div>
        )}
 
        {/* Gasto SOLO (sem saldo - so cartao de credito) */}
        {!temSaldoCard && temGastoCard && (
          <div
            className="rounded-3xl overflow-hidden relative p-6 mb-6"
            style={CARD_GRADIENT_STYLE}
          >
            <p className="text-xs uppercase tracking-widest font-bold text-[#7cdbb9]">
              Total gasto — últimos 30 dias
            </p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-white/60 text-lg font-medium">R$</span>
              <span className="text-white text-5xl font-bold tracking-tight">
                {fmtShort(totalBanco)}
              </span>
              <span className="text-white/40 text-2xl font-medium">
                ,{fmt(totalBanco).split(',')[1]}
              </span>
            </div>
          </div>
        )}
 
        {/* =========== ESTADO FREE =========== */}
        {plano === 'free' && !fatura && (
          <div className="rounded-3xl p-8 text-center bg-white/5 border border-white/10">
            <p className="text-white text-lg font-bold mb-2">
              Nenhuma fatura analisada ainda
            </p>
            <p className="text-white/60 text-sm mb-6">
              Envie o PDF da sua fatura e a Menta organiza tudo pra você.
            </p>
            <a
              href="/upload"
              className="inline-block px-6 py-3 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors no-underline"
            >
              Enviar primeira fatura
            </a>
          </div>
        )}
 
        {plano === 'free' && fatura && (
          <>
            <div
              className="rounded-3xl overflow-hidden relative p-6"
              style={CARD_GRADIENT_STYLE}
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
            </div>
 
            {fatura.insight && (
              <div className="mt-4 rounded-3xl p-5 bg-white" style={{ border: '1px solid rgba(122,217,183,0.4)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full grid place-items-center shrink-0 bg-[#7ad9b7]/25 text-sm font-bold text-[#3d7d66]">
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
                  const pct = somaFatura > 0 ? (cat.valor / somaFatura) * 100 : 0;
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
 
        {/* =========== PREMIUM SEM CONEXAO =========== */}
        {plano === 'premium' && !temConexao && (
          <div className="rounded-3xl p-8 text-center bg-white/5 border border-white/10">
            <div className="w-16 h-16 mx-auto rounded-full grid place-items-center bg-[#7ad9b7]/20 text-[#7ad9b7] mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <p className="text-white text-lg font-bold mb-2">
              Bem-vindo ao Premium
            </p>
            <p className="text-white/60 text-sm mb-6 leading-relaxed">
              Conecte sua conta bancária para a Menta puxar suas transações automaticamente.
            </p>
            <a
              href="/conectar"
              className="inline-block px-6 py-3 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors no-underline"
            >
              Conectar conta bancária
            </a>
          </div>
        )}
 
        {/* =========== PREMIUM CONEXAO MAS SEM TX RECENTE =========== */}
        {plano === 'premium' && temConexao && !temTxRecente && (
          <div className="rounded-3xl p-8 text-center bg-white/5 border border-white/10">
            <p className="text-white text-lg font-bold mb-2">
              Sem transações nos últimos 30 dias
            </p>
            <p className="text-white/60 text-sm mb-6 leading-relaxed">
              Sua conta está conectada. Sincronize de novo ou aguarde novas transações aparecerem aqui.
            </p>
            <a
              href="/conectar"
              className="inline-block px-6 py-3 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors no-underline"
            >
              Sincronizar agora
            </a>
          </div>
        )}
 
        {/* =========== Categorias do banco (quando tem gasto recente) =========== */}
        {plano === 'premium' && temTxRecente && (
          <div className="mt-2">
            <h2 className="font-bold text-base text-white mb-3">
              Para onde foi o dinheiro
            </h2>
            <div className="space-y-2">
              {categoriasBanco.map((cat, i) => {
                const pct = totalBanco > 0 ? (cat.valor / totalBanco) * 100 : 0;
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
        )}
 
        {/* Link discreto pro historico de PDFs */}
        {temFaturasAntigas && plano === 'premium' && (
          <div className="mt-8 text-center">
            <a
              href="/historico"
              className="text-white/40 hover:text-white/70 text-sm transition-colors no-underline"
            >
              Ver histórico de faturas em PDF →
            </a>
          </div>
        )}
 
      </div>
    </main>
  );
}