'use client';
 
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getOuCriaPerfil } from '@/lib/perfil';
import { Sparkles, Coffee, Car, ShoppingBag, Heart, MoreHorizontal, FileText, Trash2, RefreshCw, Wallet, CreditCard, Search, X } from 'lucide-react';
 
const COLORS = {
  primary: '#7ad9b7',
  primaryLight: '#7cdbb9',
  primaryMid: '#3d7d66',
  dark1: '#183e31',
  ink: '#010302',
  muted: '#86958f',
  danger: '#d96a6a',
};
 
// ===== Tipos =====
type Categoria = { nome: string; valor: number };
type Transacao = { descricao: string; valor: number; categoria: string };
type Fatura = {
  id: string;
  nome_original: string;
  status: string;
  criado_em: string;
  arquivo_path: string | null;
  total: number | null;
  categorias: Categoria[] | null;
  transacoes: Transacao[] | null;
  insight: string | null;
  analisado_em: string | null;
};
type TransacaoBanco = {
  id: string;
  data: string;
  descricao: string | null;
  valor: number | string;
  tipo: string | null;
  categoria: string | null;
  merchant_nome: string | null;
  conta_id: string;
};
type ContaBancaria = {
  id: string;
  nome: string | null;
  tipo: string | null;
  subtipo: string | null;
};
 
// ===== Helpers =====
function iconePorCategoria(nome: string) {
  const n = (nome || '').toLowerCase();
  if (n.includes('aliment') || n.includes('food') || n.includes('drink') || n.includes('restaurant')) return Coffee;
  if (n.includes('transp') || n.includes('uber') || n.includes('taxi') || n.includes('travel')) return Car;
  if (n.includes('compra') || n.includes('shop') || n.includes('market')) return ShoppingBag;
  if (n.includes('lazer') || n.includes('saude') || n.includes('saúde') || n.includes('health') || n.includes('leisure')) return Heart;
  return MoreHorizontal;
}
const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CORES_BARRA = ['#7ad9b7', '#3d7d66', '#7cdbb9', '#407c66', '#183e31'];
 
// 9 categorias canonicas da Menta (para edicao de categoria - #4)
const CATEGORIAS_CANONICAS = [
  'Alimentação', 'Transporte', 'Compras', 'Lazer', 'Saúde',
  'Educação', 'Moradia', 'Serviços', 'Outros',
];
 
// Nomes de mes pra agrupar os gastos futuros (#6)
const MESES_LONGOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
 
// Formata data YYYY-MM-DD em DD/MM
function fmtDataCurta(s: string): string {
  if (!s) return '';
  const partes = s.slice(0, 10).split('-');
  if (partes.length !== 3) return s;
  return `${partes[2]}/${partes[1]}`;
}
 
// Chave de mes (YYYY-MM) -> rotulo "Agosto 2026" (#6)
function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split('-');
  const idx = parseInt(mes, 10) - 1;
  if (idx < 0 || idx > 11) return chave;
  return `${MESES_LONGOS[idx]} ${ano}`;
}
 
function GastosConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoriaURL = searchParams.get('categoria'); // #5: filtro vindo da dashboard
 
  const [carregando, setCarregando] = useState(true);
  const [plano, setPlano] = useState<'free' | 'premium'>('free');
  const [temConexao, setTemConexao] = useState(false);
 
  // ===== Estado: modo PDF (free ou premium sem conexao) =====
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [filtro, setFiltro] = useState('Todos');
  const [confirmandoId, setConfirmandoId] = useState('');
  const [removendoId, setRemovendoId] = useState('');
  const [avisoRemover, setAvisoRemover] = useState('');
 
  // ===== Estado: modo Timeline (premium com conexao) =====
  const [periodo, setPeriodo] = useState<7 | 30>(30); // #7: removido o 90
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [contaFiltro, setContaFiltro] = useState<string>('todas');
  const [catFiltro, setCatFiltro] = useState('Todos'); // #3: filtro de categoria no timeline
  const [txs, setTxs] = useState<TransacaoBanco[]>([]);
  const [carregandoTxs, setCarregandoTxs] = useState(false);
  const [temFaturasAntigas, setTemFaturasAntigas] = useState(false);
 
  // #5: busca por texto (descricao/merchant/categoria). Aplica ao apertar enter.
  const [buscaInput, setBuscaInput] = useState(''); // o que o usuario digita
  const [busca, setBusca] = useState('');           // o que foi efetivamente buscado
 
  // #6: visao passado (gastos ja feitos) vs futuro (parcelas/gastos futuros por mes)
  const [visao, setVisao] = useState<'passado' | 'futuro'>('passado');
  const [txsFuturas, setTxsFuturas] = useState<TransacaoBanco[]>([]);
  const [carregandoFuturas, setCarregandoFuturas] = useState(false);
 
  // #4: edicao de categoria de uma transacao do banco
  const [txEditando, setTxEditando] = useState<TransacaoBanco | null>(null);
  const [salvandoCat, setSalvandoCat] = useState(false);
  const [erroCat, setErroCat] = useState('');
 
  // Salva a nova categoria via /api/transacao/categoria e atualiza local na hora
  async function salvarCategoria(novaCategoria: string) {
    if (!txEditando) return;
    setSalvandoCat(true);
    setErroCat('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setErroCat('Sua sessao expirou. Saia e entre de novo.'); setSalvandoCat(false); return; }
 
      const resp = await fetch('/api/transacao/categoria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ transacaoId: txEditando.id, novaCategoria }),
      });
      const dados = await resp.json();
      if (!dados.sucesso) { setErroCat(dados.erro || 'Nao foi possivel atualizar.'); setSalvandoCat(false); return; }
 
      // atualiza nas duas listas (passado e futuro) por seguranca
      setTxs((prev) => prev.map((t) => (t.id === txEditando.id ? { ...t, categoria: novaCategoria } : t)));
      setTxsFuturas((prev) => prev.map((t) => (t.id === txEditando.id ? { ...t, categoria: novaCategoria } : t)));
      setTxEditando(null);
      setSalvandoCat(false);
    } catch {
      setErroCat('A conexao falhou. Tente de novo.');
      setSalvandoCat(false);
    }
  }
 
  // Aplica a categoria vinda da URL (dashboard -> aqui), nos dois modos.
  useEffect(() => {
    if (categoriaURL) {
      setFiltro(categoriaURL);
      setCatFiltro(categoriaURL);
    }
  }, [categoriaURL]);
 
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
 
      const perfil = await getOuCriaPerfil(user.id);
      const ehPremium = perfil?.plano === 'premium';
      setPlano(ehPremium ? 'premium' : 'free');
 
      if (ehPremium) {
        const { count: connCount } = await supabase
          .from('connections')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        const conectado = (connCount || 0) > 0;
        setTemConexao(conectado);
 
        const { count: fatCount } = await supabase
          .from('faturas')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .not('analisado_em', 'is', null);
        setTemFaturasAntigas((fatCount || 0) > 0);
 
        if (conectado) {
          const { data: contasData } = await supabase
            .from('contas_bancarias')
            .select('id, nome, tipo, subtipo')
            .eq('user_id', user.id);
          setContas((contasData || []) as ContaBancaria[]);
        }
      }
 
      // Sempre busca faturas (vale para Free e Premium sem conexao)
      const { data: faturasData } = await supabase
        .from('faturas')
        .select('*')
        .order('criado_em', { ascending: false });
      if (faturasData) setFaturas(faturasData as Fatura[]);
 
      setCarregando(false);
    }
    init();
  }, [router]);
 
  // Carrega transacoes do banco quando muda periodo (modo timeline, visao PASSADO)
  useEffect(() => {
    if (plano !== 'premium' || !temConexao) return;
 
    async function carregarTxs() {
      setCarregandoTxs(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
 
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - periodo);
      const limite = inicio.toISOString().slice(0, 10);
      // Teto: ate hoje. Parcelas com data futura nao entram no periodo (#6).
      const hoje = new Date().toISOString().slice(0, 10);
 
      const { data } = await supabase
        .from('transacoes_banco')
        .select('id, data, descricao, valor, tipo, categoria, merchant_nome, conta_id')
        .eq('user_id', user.id)
        .gte('data', limite)
        .lte('data', hoje)
        .order('data', { ascending: false });
 
      setTxs((data || []) as TransacaoBanco[]);
      setCarregandoTxs(false);
    }
    carregarTxs();
  }, [plano, temConexao, periodo]);
 
  // #6: carrega os gastos FUTUROS (parcelas/assinaturas com data > hoje),
  // limitado aos proximos 6 meses. Carregado uma vez quando entra no timeline.
  useEffect(() => {
    if (plano !== 'premium' || !temConexao) return;
 
    async function carregarFuturas() {
      setCarregandoFuturas(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
 
      const hoje = new Date();
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      const inicioFuturo = amanha.toISOString().slice(0, 10);
      // teto: 6 meses pra frente
      const fim = new Date(hoje);
      fim.setMonth(fim.getMonth() + 6);
      const limiteFuturo = fim.toISOString().slice(0, 10);
 
      const { data } = await supabase
        .from('transacoes_banco')
        .select('id, data, descricao, valor, tipo, categoria, merchant_nome, conta_id')
        .eq('user_id', user.id)
        .gte('data', inicioFuturo)
        .lte('data', limiteFuturo)
        .order('data', { ascending: true });
 
      setTxsFuturas((data || []) as TransacaoBanco[]);
      setCarregandoFuturas(false);
    }
    carregarFuturas();
  }, [plano, temConexao]);
 
  // Remove fatura PDF (modo PDF)
  async function removerFatura(f: Fatura) {
    setRemovendoId(f.id);
    setAvisoRemover('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setAvisoRemover('Sua sessao expirou. Saia e entre de novo para continuar.');
        setRemovendoId('');
        return;
      }
      const resp = await fetch('/api/remover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ faturaId: f.id }),
      });
      const dados = await resp.json();
      if (!dados.sucesso) {
        setAvisoRemover('Nao foi possivel remover a fatura agora. Tente de novo.');
        setRemovendoId('');
        return;
      }
      setFaturas((prev) => prev.filter((x) => x.id !== f.id));
      setConfirmandoId('');
      setRemovendoId('');
    } catch {
      setAvisoRemover('A conexao falhou. Verifique sua internet e tente de novo.');
      setRemovendoId('');
    }
  }
 
  if (carregando) {
    // Skeleton: replica o cabecalho dark + corpo branco com filtros e lista
    return (
      <div>
        {/* Cabecalho */}
        <div style={{ background: COLORS.dark1, padding: '48px 24px 24px', borderRadius: '0 0 28px 28px' }}>
          <div
            className="animate-pulse"
            style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', marginBottom: '24px' }}
          />
          <div
            className="animate-pulse"
            style={{ height: '32px', width: '60%', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', marginBottom: '24px' }}
          />
          <div style={{ background: 'white', borderRadius: '16px', padding: '16px', border: '1px solid #eef2ef' }}>
            <div
              className="animate-pulse"
              style={{ height: '14px', width: '40%', borderRadius: '4px', background: '#e6edea', marginBottom: '8px' }}
            />
            <div
              className="animate-pulse"
              style={{ height: '24px', width: '60%', borderRadius: '6px', background: '#e6edea' }}
            />
          </div>
        </div>
 
        {/* Corpo */}
        <div style={{ padding: '24px' }}>
          {/* Filtros chips */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div className="animate-pulse" style={{ height: '36px', width: '80px', borderRadius: '999px', background: '#e6edea' }} />
            <div className="animate-pulse" style={{ height: '36px', width: '100px', borderRadius: '999px', background: '#e6edea' }} />
            <div className="animate-pulse" style={{ height: '36px', width: '90px', borderRadius: '999px', background: '#e6edea' }} />
          </div>
 
          {/* Lista de transacoes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{ background: 'white', borderRadius: '16px', padding: '12px', border: '1px solid #eef2ef', display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div className="animate-pulse" style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#e6edea', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="animate-pulse" style={{ height: '14px', width: '70%', borderRadius: '4px', background: '#e6edea', marginBottom: '6px' }} />
                  <div className="animate-pulse" style={{ height: '11px', width: '40%', borderRadius: '4px', background: '#e6edea' }} />
                </div>
                <div className="animate-pulse" style={{ height: '18px', width: '70px', borderRadius: '4px', background: '#e6edea' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
 
  // =========================================================
  // BRANCH: Premium COM conexao -> modo Timeline
  // =========================================================
  if (plano === 'premium' && temConexao) {
    // Fonte de dados conforme a visao (#6): passado usa txs, futuro usa txsFuturas
    const fonte = visao === 'futuro' ? txsFuturas : txs;
 
    // Filtra transacoes pela conta selecionada
    const porConta =
      contaFiltro === 'todas' ? fonte : fonte.filter((t) => t.conta_id === contaFiltro);
 
    // #3: categorias presentes nas transacoes (debitos), pra montar os chips
    const catsDisponiveis = Array.from(
      new Set(
        porConta
          .filter((t) => t.tipo === 'DEBIT')
          .map((t) => (t.categoria || 'Outros').trim() || 'Outros')
      )
    );
    const filtrosCategoria = ['Todos', ...catsDisponiveis];
 
    // aplica filtro de categoria (#3) por cima do filtro de conta
    const aposCategoria =
      catFiltro === 'Todos'
        ? porConta
        : porConta.filter((t) => ((t.categoria || 'Outros').trim() || 'Outros') === catFiltro);
 
    // #5: aplica a busca por texto (descricao, merchant ou categoria)
    const termo = busca.trim().toLowerCase();
    const txsFiltradas = termo === ''
      ? aposCategoria
      : aposCategoria.filter((t) => {
          const desc = (t.descricao || '').toLowerCase();
          const merch = (t.merchant_nome || '').toLowerCase();
          const cat = (t.categoria || '').toLowerCase();
          return desc.includes(termo) || merch.includes(termo) || cat.includes(termo);
        });
 
    // Calcula stats (so DEBITs = gastos)
    const debits = txsFiltradas.filter((t) => t.tipo === 'DEBIT');
    const totalGasto = debits.reduce((acc, t) => acc + Math.abs(Number(t.valor || 0)), 0);
 
    // #6: agrupa por mes quando na visao futuro
    const gruposPorMes: { chave: string; itens: TransacaoBanco[]; total: number }[] = [];
    if (visao === 'futuro') {
      const mapa = new Map<string, TransacaoBanco[]>();
      for (const t of txsFiltradas) {
        const chave = t.data.slice(0, 7); // YYYY-MM
        if (!mapa.has(chave)) mapa.set(chave, []);
        mapa.get(chave)!.push(t);
      }
      for (const [chave, itens] of Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        const total = itens
          .filter((t) => t.tipo === 'DEBIT')
          .reduce((acc, t) => acc + Math.abs(Number(t.valor || 0)), 0);
        gruposPorMes.push({ chave, itens, total });
      }
    }
 
    const carregandoVisao = visao === 'futuro' ? carregandoFuturas : carregandoTxs;
 
    function aplicarBusca() { setBusca(buscaInput); }
    function limparBusca() { setBuscaInput(''); setBusca(''); }
 
    return (
      <div>
        {/* Cabecalho com fundo escuro */}
        <div style={{ background: COLORS.dark1, padding: '48px 24px 24px', borderRadius: '0 0 28px 28px' }}>
          <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 700, margin: 0 }}>Suas transações</h1>
          <p style={{ color: COLORS.primaryLight, fontSize: '14px', marginTop: '4px' }}>
            {visao === 'futuro' ? 'Gastos futuros · próximos 6 meses' : `Direto do seu banco · últimos ${periodo} dias`}
          </p>
        </div>
 
        {/* #6: Chip de visao Passado / Futuro */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['passado', 'futuro'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVisao(v)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: visao === v ? COLORS.primary : 'white',
                  color: visao === v ? COLORS.ink : COLORS.primaryMid,
                  border: visao === v ? 'none' : '1px solid #e6ebe8',
                }}
              >
                {v === 'passado' ? 'Já gastei' : 'Gastos futuros'}
              </button>
            ))}
          </div>
        </div>
 
        {/* Stats: no passado mostra total+contagem; no futuro mostra total futuro */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '16px', border: '1px solid #eef2ef' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.primaryMid, margin: 0 }}>
              {visao === 'futuro' ? 'Total a pagar' : 'Gasto no período'}
            </p>
            <p style={{ fontSize: '22px', fontWeight: 700, color: COLORS.ink, margin: '4px 0 0' }}>
              R$ {fmt(totalGasto)}
            </p>
          </div>
          <div style={{ background: COLORS.dark1, borderRadius: '16px', padding: '16px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.primaryLight, margin: 0 }}>
              Transações
            </p>
            <p style={{ fontSize: '22px', fontWeight: 700, color: 'white', margin: '4px 0 0' }}>
              {txsFiltradas.length}
            </p>
          </div>
        </div>
 
        {/* #5: Barra de busca (lupa) */}
        <div style={{ padding: '0 16px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid #e6ebe8', borderRadius: '999px', padding: '8px 14px' }}>
            <Search size={16} color={COLORS.muted} />
            <input
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') aplicarBusca(); }}
              placeholder="Buscar gasto, loja ou categoria..."
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', color: COLORS.ink, background: 'transparent' }}
            />
            {buscaInput && (
              <button onClick={limparBusca} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }}>
                <X size={16} color={COLORS.muted} />
              </button>
            )}
          </div>
          {busca && (
            <p style={{ fontSize: '11px', color: COLORS.muted, margin: '6px 4px 0' }}>
              Buscando por &quot;{busca}&quot; · {txsFiltradas.length} resultado(s)
            </p>
          )}
        </div>
 
        {/* Chips de periodo (so na visao PASSADO - #6/#7) */}
        {visao === 'passado' && (
          <div style={{ padding: '12px 16px 0' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '6px' }}>
              Período
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[7, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setPeriodo(d as 7 | 30)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: periodo === d ? COLORS.primary : 'white',
                    color: periodo === d ? COLORS.ink : COLORS.primaryMid,
                    border: periodo === d ? 'none' : '1px solid #e6ebe8',
                  }}
                >
                  {d} dias
                </button>
              ))}
            </div>
          </div>
        )}
 
        {/* #3: Chips de categoria (so aparece se houver categorias) */}
        {filtrosCategoria.length > 1 && (
          <div style={{ padding: '12px 16px 0' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '6px' }}>
              Categoria
            </p>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {filtrosCategoria.map((c) => (
                <button
                  key={c}
                  onClick={() => setCatFiltro(c)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    background: catFiltro === c ? COLORS.primary : 'white',
                    color: catFiltro === c ? COLORS.ink : COLORS.primaryMid,
                    border: catFiltro === c ? 'none' : '1px solid #e6ebe8',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
 
        {/* Chips de conta */}
        {contas.length > 0 && (
          <div style={{ padding: '12px 16px 0' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.muted, marginBottom: '6px' }}>
              Conta
            </p>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                onClick={() => setContaFiltro('todas')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  background: contaFiltro === 'todas' ? COLORS.primary : 'white',
                  color: contaFiltro === 'todas' ? COLORS.ink : COLORS.primaryMid,
                  border: contaFiltro === 'todas' ? 'none' : '1px solid #e6ebe8',
                }}
              >
                Todas
              </button>
              {contas.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setContaFiltro(c.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: contaFiltro === c.id ? COLORS.primary : 'white',
                    color: contaFiltro === c.id ? COLORS.ink : COLORS.primaryMid,
                    border: contaFiltro === c.id ? 'none' : '1px solid #e6ebe8',
                  }}
                >
                  {c.tipo === 'CREDIT' ? <CreditCard size={12} /> : <Wallet size={12} />}
                  {c.nome || 'Conta'}
                </button>
              ))}
            </div>
          </div>
        )}
 
        {/* Lista de transacoes */}
        <div style={{ padding: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.ink, marginBottom: '12px' }}>
            {visao === 'futuro' ? 'O que ainda vai cair' : 'Movimentações'}
          </h2>
 
          {carregandoVisao ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  style={{ background: 'white', borderRadius: '16px', padding: '12px', border: '1px solid #eef2ef', display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div className="animate-pulse" style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#e6edea', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="animate-pulse" style={{ height: '14px', width: '70%', borderRadius: '4px', background: '#e6edea', marginBottom: '6px' }} />
                    <div className="animate-pulse" style={{ height: '11px', width: '40%', borderRadius: '4px', background: '#e6edea' }} />
                  </div>
                  <div className="animate-pulse" style={{ height: '18px', width: '70px', borderRadius: '4px', background: '#e6edea' }} />
                </div>
              ))}
            </div>
          ) : txsFiltradas.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', textAlign: 'center', border: '1px solid #eef2ef' }}>
              <p style={{ color: COLORS.ink, fontWeight: 600, margin: 0 }}>
                {busca
                  ? 'Nada encontrado pra essa busca'
                  : visao === 'futuro'
                  ? 'Nenhum gasto futuro previsto'
                  : 'Nenhuma movimentação nesse período'}
              </p>
              <p style={{ color: COLORS.muted, fontSize: '12px', marginTop: '4px' }}>
                {busca
                  ? 'Tente outro termo ou limpe a busca.'
                  : visao === 'futuro'
                  ? 'Parcelas e assinaturas futuras aparecem aqui.'
                  : 'Mude o filtro ou sincronize a conta de novo.'}
              </p>
            </div>
          ) : visao === 'futuro' ? (
            /* #6: visao futuro -> agrupada por mes */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {gruposPorMes.map((g) => (
                <div key={g.chave}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: COLORS.primaryMid, margin: 0 }}>
                      {rotuloMes(g.chave)}
                    </h3>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.ink }}>
                      R$ {fmt(g.total)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {g.itens.map((t) => {
                      const Icon = iconePorCategoria(t.categoria || '');
                      const valor = Math.abs(Number(t.valor || 0));
                      const ehDebit = t.tipo === 'DEBIT';
                      const desc = (t.descricao || t.merchant_nome || 'Sem descrição').trim();
                      return (
                        <div
                          key={t.id}
                          onClick={() => { if (ehDebit) { setErroCat(''); setTxEditando(t); } }}
                          style={{ background: 'white', borderRadius: '16px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #eef2ef', cursor: ehDebit ? 'pointer' : 'default' }}
                        >
                          <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: '#f4f7f5', flexShrink: 0 }}>
                            <Icon size={18} color={COLORS.primaryMid} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: '14px', color: COLORS.ink, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {desc}
                            </p>
                            <p style={{ fontSize: '11px', color: COLORS.muted, margin: '2px 0 0' }}>
                              {fmtDataCurta(t.data)}{t.categoria ? ` · ${t.categoria}` : ''}
                            </p>
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: COLORS.ink, flexShrink: 0 }}>
                            R$ {fmt(valor)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* visao passado -> lista corrida */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {txsFiltradas.map((t) => {
                const Icon = iconePorCategoria(t.categoria || '');
                const valor = Math.abs(Number(t.valor || 0));
                const ehDebit = t.tipo === 'DEBIT';
                const corValor = ehDebit ? COLORS.ink : COLORS.primaryMid;
                const sinal = ehDebit ? '' : '+';
                const desc = (t.descricao || t.merchant_nome || 'Sem descrição').trim();
 
                return (
                  <div
                    key={t.id}
                    onClick={() => { if (ehDebit) { setErroCat(''); setTxEditando(t); } }}
                    style={{ background: 'white', borderRadius: '16px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #eef2ef', cursor: ehDebit ? 'pointer' : 'default' }}
                  >
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: '#f4f7f5', flexShrink: 0 }}>
                      <Icon size={18} color={COLORS.primaryMid} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '14px', color: COLORS.ink, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {desc}
                      </p>
                      <p style={{ fontSize: '11px', color: COLORS.muted, margin: '2px 0 0' }}>
                        {fmtDataCurta(t.data)}{t.categoria ? ` · ${t.categoria}` : ''}{ehDebit ? ' · clique p/ editar' : ''}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: corValor }}>
                        {sinal}R$ {fmt(valor)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
 
        {/* Link discreto para o historico de PDFs */}
        {temFaturasAntigas && (
          <div style={{ padding: '0 16px 24px', textAlign: 'center' }}>
            <button
              onClick={() => {
                alert('Para acessar o histórico de PDFs, desconecte o banco temporariamente em /conectar. Em breve, uma tela dedicada para o histórico.');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: COLORS.muted,
                fontSize: '13px',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Ver histórico de faturas em PDF →
            </button>
          </div>
        )}
 
        {/* #4: Modal pra trocar a categoria da transacao */}
        {txEditando && (
          <div
            onClick={() => !salvandoCat && setTxEditando(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'white', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '380px', maxHeight: '85vh', overflowY: 'auto' }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: COLORS.ink, margin: 0 }}>Mudar categoria</h3>
              <p style={{ fontSize: '13px', color: COLORS.muted, margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {(txEditando.descricao || txEditando.merchant_nome || 'Transação').trim()}
              </p>
 
              {erroCat && <p style={{ fontSize: '12px', color: COLORS.danger, marginTop: '10px' }}>{erroCat}</p>}
 
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {CATEGORIAS_CANONICAS.map((cat) => {
                  const atual = (txEditando.categoria || '').trim() === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => !salvandoCat && salvarCategoria(cat)}
                      disabled={salvandoCat}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '13px 16px', borderRadius: '14px', cursor: salvandoCat ? 'default' : 'pointer',
                        background: atual ? 'rgba(122,217,183,0.18)' : '#f4f7f5',
                        border: `1px solid ${atual ? COLORS.primary : '#eef2ef'}`,
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: '15px', fontWeight: 600, color: atual ? COLORS.primaryMid : COLORS.ink }}>{cat}</span>
                      {atual && <span style={{ fontSize: '12px', fontWeight: 700, color: COLORS.primaryMid }}>✓ atual</span>}
                    </button>
                  );
                })}
              </div>
 
              <button
                onClick={() => !salvandoCat && setTxEditando(null)}
                style={{ marginTop: '16px', width: '100%', padding: '12px', background: 'transparent', border: 'none', color: COLORS.muted, fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
              >
                {salvandoCat ? 'Salvando...' : 'Cancelar'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
 
  // =========================================================
  // BRANCH PADRAO: Free OU Premium sem conexao -> modo PDF
  // =========================================================
 
  const ultimaAnalisada = faturas.find((f) => f.status === 'analisada' && f.categorias);
  const categorias = ultimaAnalisada?.categorias ?? [];
  const transacoes = ultimaAnalisada?.transacoes ?? [];
  const totalUltima = ultimaAnalisada?.total ?? 0;
  const maiorValor = categorias.reduce((max, c) => (c.valor > max ? c.valor : max), 0);
  const filtros = ['Todos', ...categorias.map((c) => c.nome)];
  // se o filtro vindo da URL nao existir nesta fatura, cai em "Todos" (evita lista vazia)
  const filtroEfetivo = filtros.includes(filtro) ? filtro : 'Todos';
  const categoriasFiltradas =
    filtroEfetivo === 'Todos' ? categorias : categorias.filter((c) => c.nome === filtroEfetivo);
  const transacoesFiltradas =
    filtroEfetivo === 'Todos' ? transacoes : transacoes.filter((t) => t.categoria === filtroEfetivo);
 
  return (
    <div>
      <div style={{ background: COLORS.dark1, padding: '48px 24px 24px', borderRadius: '0 0 28px 28px' }}>
        <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 700, margin: 0 }}>Seus gastos</h1>
        <p style={{ color: COLORS.primaryLight, fontSize: '14px', marginTop: '4px' }}>
          A IA ja categorizou tudo pra voce
        </p>
      </div>
 
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '16px', border: '1px solid #eef2ef' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.primaryMid, margin: 0 }}>
            Ultima fatura
          </p>
          <p style={{ fontSize: '22px', fontWeight: 700, color: COLORS.ink, margin: '4px 0 0' }}>
            R$ {fmt(totalUltima)}
          </p>
        </div>
        <div style={{ background: COLORS.dark1, borderRadius: '16px', padding: '16px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.primaryLight, margin: 0 }}>
            Faturas
          </p>
          <p style={{ fontSize: '22px', fontWeight: 700, color: 'white', margin: '4px 0 0' }}>
            {faturas.length}
          </p>
        </div>
      </div>
 
      {categorias.length === 0 ? (
        <div style={{ margin: '0 16px', background: 'white', borderRadius: '16px', padding: '32px', textAlign: 'center', border: '1px solid #eef2ef' }}>
          <p style={{ color: COLORS.ink, fontWeight: 600, margin: 0 }}>Nenhuma fatura analisada ainda</p>
          <p style={{ color: COLORS.muted, fontSize: '13px', marginTop: '8px' }}>
            Envie uma fatura na tela de upload pra IA categorizar seus gastos.
          </p>
          <button
            onClick={() => router.push('/upload')}
            style={{ marginTop: '16px', background: COLORS.primary, color: COLORS.ink, border: 'none', borderRadius: '12px', padding: '12px 20px', fontWeight: 700, cursor: 'pointer' }}
          >
            Enviar fatura
          </button>
        </div>
      ) : (
        <>
          <div style={{ padding: '4px 16px 0', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: '8px', minWidth: 'max-content' }}>
              {filtros.map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    background: filtroEfetivo === f ? COLORS.primary : 'white',
                    color: filtroEfetivo === f ? COLORS.ink : COLORS.primaryMid,
                    border: filtroEfetivo === f ? 'none' : '1px solid #e6ebe8',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
 
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {categoriasFiltradas.map((cat, i) => {
              const Icon = iconePorCategoria(cat.nome);
              const cor = CORES_BARRA[i % CORES_BARRA.length];
              const largura = maiorValor > 0 ? (cat.valor / maiorValor) * 100 : 0;
              return (
                <div key={cat.nome} style={{ background: 'white', borderRadius: '16px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #eef2ef' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: `${cor}20`, flexShrink: 0 }}>
                    <Icon size={20} color={cor} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: COLORS.ink }}>{cat.nome}</span>
                        <span style={{ fontSize: '8px', padding: '2px 6px', borderRadius: '999px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', background: `${COLORS.primary}20`, color: COLORS.primaryMid, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <Sparkles size={8} /> IA
                        </span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: COLORS.ink }}>R$ {fmt(cat.valor)}</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '999px', background: '#f0f4f1', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '999px', width: `${largura}%`, background: cor }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
 
          {transacoesFiltradas.length > 0 && (
            <div style={{ padding: '0 16px 16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.ink, marginBottom: '12px' }}>
                {filtroEfetivo === 'Todos' ? 'Todas as compras' : `Compras em ${filtroEfetivo}`}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {transacoesFiltradas.map((t, i) => {
                  const Icon = iconePorCategoria(t.categoria);
                  return (
                    <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #eef2ef' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: '#f4f7f5', flexShrink: 0 }}>
                        <Icon size={18} color={COLORS.primaryMid} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <p style={{ fontWeight: 600, fontSize: '14px', color: COLORS.ink, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.descricao}
                          </p>
                          <span style={{ fontSize: '8px', padding: '2px 6px', borderRadius: '999px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', background: `${COLORS.primary}20`, color: COLORS.primaryMid, display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                            <Sparkles size={8} /> IA
                          </span>
                        </div>
                        <p style={{ fontSize: '11px', color: COLORS.muted, margin: '2px 0 0' }}>{t.categoria}</p>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: COLORS.ink }}>R$ {fmt(t.valor)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
 
          <div style={{ padding: '0 16px 16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.ink, marginBottom: '12px' }}>
              Historico de faturas
            </h2>
 
            {avisoRemover && (
              <p style={{ fontSize: '12px', color: COLORS.danger, marginBottom: '8px' }}>
                {avisoRemover}
              </p>
            )}
 
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {faturas.map((f) => (
                <div key={f.id} style={{ background: 'white', borderRadius: '16px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #eef2ef' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: '#f4f7f5', flexShrink: 0 }}>
                    <FileText size={18} color={COLORS.primaryMid} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '14px', color: COLORS.ink, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.nome_original}
                    </p>
                    <p style={{ fontSize: '11px', color: COLORS.muted, margin: '2px 0 0' }}>
                      {new Date(f.criado_em).toLocaleDateString('pt-BR')} · {f.status}
                    </p>
                  </div>
 
                  {confirmandoId === f.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontSize: '12px', color: COLORS.muted }}>Remover?</span>
                      <button
                        onClick={() => removerFatura(f)}
                        disabled={removendoId === f.id}
                        style={{ background: COLORS.danger, color: 'white', border: 'none', borderRadius: '999px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: removendoId === f.id ? 0.6 : 1 }}
                      >
                        {removendoId === f.id ? '...' : 'Sim'}
                      </button>
                      <button
                        onClick={() => setConfirmandoId('')}
                        disabled={removendoId === f.id}
                        style={{ background: 'white', color: COLORS.muted, border: '1px solid #e6ebe8', borderRadius: '999px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Nao
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      {f.total != null && (
                        <span style={{ fontWeight: 700, fontSize: '14px', color: COLORS.ink }}>
                          R$ {fmt(f.total)}
                        </span>
                      )}
                      <button
                        onClick={() => { setConfirmandoId(f.id); setAvisoRemover(''); }}
                        aria-label="Remover fatura"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'grid', placeItems: 'center' }}
                      >
                        <Trash2 size={16} color={COLORS.muted} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
 
// useSearchParams exige Suspense no Next.js (App Router). Embrulha o conteudo.
export default function GastosPage() {
  return (
    <Suspense fallback={null}>
      <GastosConteudo />
    </Suspense>
  );
}