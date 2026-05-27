'use client';
 
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Sparkles, Coffee, Car, ShoppingBag, Heart, MoreHorizontal, FileText, Trash2 } from 'lucide-react';
 
// Paleta oficial Menta
const COLORS = {
  primary: '#7ad9b7',
  primaryLight: '#7cdbb9',
  primaryMid: '#3d7d66',
  dark1: '#183e31',
  ink: '#010302',
  muted: '#86958f',
  danger: '#d96a6a',
};
 
// Tipos dos dados que vem do banco
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
 
// Escolhe um icone pra cada categoria (pelo nome)
function iconePorCategoria(nome: string) {
  const n = nome.toLowerCase();
  if (n.includes('aliment')) return Coffee;
  if (n.includes('transp')) return Car;
  if (n.includes('compra')) return ShoppingBag;
  if (n.includes('lazer') || n.includes('saude') || n.includes('saúde')) return Heart;
  return MoreHorizontal;
}
 
// Formata numero como dinheiro
const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 
// Cores que vamos rotacionar nas barras das categorias
const CORES_BARRA = ['#7ad9b7', '#3d7d66', '#7cdbb9', '#407c66', '#183e31'];
 
export default function GastosPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [filtro, setFiltro] = useState('Todos');
 
  // Controle da remocao de faturas
  const [confirmandoId, setConfirmandoId] = useState('');
  const [removendoId, setRemovendoId] = useState('');
  const [avisoRemover, setAvisoRemover] = useState('');
 
  useEffect(() => {
    async function carregar() {
      // confere se esta logado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
 
      // busca todas as faturas do usuario, mais recentes primeiro
      const { data, error } = await supabase
        .from('faturas')
        .select('*')
        .order('criado_em', { ascending: false });
 
      if (!error && data) {
        setFaturas(data as Fatura[]);
      }
      setCarregando(false);
    }
    carregar();
  }, [router]);
 
  // Remove uma fatura (banco + storage) pela rota protegida
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ faturaId: f.id }),
      });
      const dados = await resp.json();
 
      if (!dados.sucesso) {
        setAvisoRemover('Nao foi possivel remover a fatura agora. Tente de novo.');
        setRemovendoId('');
        return;
      }
 
      // tira da lista na tela
      setFaturas((prev) => prev.filter((x) => x.id !== f.id));
      setConfirmandoId('');
      setRemovendoId('');
    } catch {
      setAvisoRemover('A conexao falhou. Verifique sua internet e tente de novo.');
      setRemovendoId('');
    }
  }
 
  // a ultima fatura que foi analisada (pra mostrar as categorias)
  const ultimaAnalisada = faturas.find((f) => f.status === 'analisada' && f.categorias);
  const categorias = ultimaAnalisada?.categorias ?? [];
  const transacoes = ultimaAnalisada?.transacoes ?? [];
  const totalUltima = ultimaAnalisada?.total ?? 0;
 
  // maior valor entre as categorias (pra calcular a largura das barras)
  const maiorValor = categorias.reduce((max, c) => (c.valor > max ? c.valor : max), 0);
 
  // lista de filtros: Todos + nomes das categorias
  const filtros = ['Todos', ...categorias.map((c) => c.nome)];
 
  // aplica o filtro escolhido nas categorias
  const categoriasFiltradas =
    filtro === 'Todos' ? categorias : categorias.filter((c) => c.nome === filtro);
 
  // aplica o filtro escolhido nas transacoes
  const transacoesFiltradas =
    filtro === 'Todos' ? transacoes : transacoes.filter((t) => t.categoria === filtro);
 
  if (carregando) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: COLORS.muted }}>
        Carregando seus gastos...
      </div>
    );
  }
 
  return (
    <div>
      {/* Cabecalho com fundo escuro */}
      <div style={{ background: COLORS.dark1, padding: '48px 24px 24px', borderRadius: '0 0 28px 28px' }}>
        <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 700, margin: 0 }}>Seus gastos</h1>
        <p style={{ color: COLORS.primaryLight, fontSize: '14px', marginTop: '4px' }}>
          A IA ja categorizou tudo pra voce
        </p>
      </div>
 
      {/* 2 cards de stats */}
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
 
      {/* Se nao tem nenhuma fatura analisada ainda */}
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
          {/* Chips de filtro */}
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
                    background: filtro === f ? COLORS.primary : 'white',
                    color: filtro === f ? COLORS.ink : COLORS.primaryMid,
                    border: filtro === f ? 'none' : '1px solid #e6ebe8',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
 
          {/* Resumo por categoria */}
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
 
          {/* Lista de transacoes individuais */}
          {transacoesFiltradas.length > 0 && (
            <div style={{ padding: '0 16px 16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.ink, marginBottom: '12px' }}>
                {filtro === 'Todos' ? 'Todas as compras' : `Compras em ${filtro}`}
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
 
          {/* Historico de faturas */}
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
                    // Modo confirmacao: Remover? Sim / Nao
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
                    // Modo normal: valor + lixeira
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