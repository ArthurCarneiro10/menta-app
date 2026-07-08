'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Sparkles, Send, Landmark } from 'lucide-react';

// Paleta oficial Menta
const COLORS = {
  primary: '#7ad9b7',
  primaryLight: '#7cdbb9',
  primaryMid: '#3d7d66',
  dark1: '#183e31',
  ink: '#010302',
  muted: '#86958f',
};

type Mensagem = { role: 'ai' | 'user'; text: string };
type Categoria = { nome: string; valor: number };
type Transacao = { descricao: string; valor: number; categoria: string };
// Debito com o banco de origem, pra poder filtrar por banco (#2)
type DebitoBanco = {
  valor: number | string | null;
  categoria: string | null;
  descricao: string | null;
  merchant_nome: string | null;
  banco: string;
};

// Monta o resumo textual que vai pra IA a partir de uma lista de debitos.
function montarTextoBanco(debits: DebitoBanco[], rotulo: string): string {
  let total = 0;
  const mapa = new Map<string, number>();
  for (const t of debits) {
    const v = Math.abs(Number(t.valor || 0));
    total += v;
    const cat = (t.categoria || 'Outros').trim() || 'Outros';
    mapa.set(cat, (mapa.get(cat) || 0) + v);
  }
  const categorias = Array.from(mapa.entries())
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);

  let texto = `Fonte: transacoes bancarias reais dos ultimos 30 dias (Open Finance) - ${rotulo}.\n`;
  texto += `Total gasto em 30 dias: R$ ${total.toFixed(2)}\n`;
  texto += `Numero de transacoes de gasto: ${debits.length}\n`;
  texto += `Gastos por categoria:\n`;
  categorias.forEach((c) => { texto += `- ${c.nome}: R$ ${c.valor.toFixed(2)}\n`; });

  const maiores = [...debits]
    .map((t) => ({
      desc: (t.descricao || t.merchant_nome || 'Sem descricao').trim(),
      cat: (t.categoria || 'Outros').trim() || 'Outros',
      valor: Math.abs(Number(t.valor || 0)),
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 15);
  texto += `Maiores gastos individuais:\n`;
  maiores.forEach((t) => { texto += `- ${t.desc} (${t.cat}): R$ ${t.valor.toFixed(2)}\n`; });
  return texto;
}

export default function IAChatPage() {
  const router = useRouter();
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    { role: 'ai', text: 'Oi! 👋 Sou sua IA financeira. Me pergunta qualquer coisa sobre seus gastos.' },
  ]);
  const [input, setInput] = useState('');
  const [pensando, setPensando] = useState(false);
  const [dadosTexto, setDadosTexto] = useState('');
  // Upsell: vira true quando o Free bate o limite de perguntas
  const [limiteAtingido, setLimiteAtingido] = useState(false);
  // #2: estado do seletor de banco
  const [bancos, setBancos] = useState<string[]>([]);
  const [debitosTodos, setDebitosTodos] = useState<DebitoBanco[]>([]);
  const [precisaEscolher, setPrecisaEscolher] = useState(false);
  const [bancoEscolhido, setBancoEscolhido] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sugestoes prontas pra clicar
  const sugestoes = [
    'Onde eu mais gastei esse mes?',
    'Quanto gastei com alimentacao?',
    'Me da uma dica pra economizar',
  ];

  // Monta o resumo que vai pra IA. Plano pago com banco -> 30 dias do banco; senao -> fatura.
  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Plano + conexao bancaria. Open Finance e exclusivo do Max, mas a checagem
      // inclui premium e max (premium simplesmente nao tera conexoes).
      const { data: perfil } = await supabase
        .from('profiles').select('plano').eq('id', user.id).maybeSingle();
      const ehPago = perfil?.plano === 'premium' || perfil?.plano === 'max';

      let temConexao = false;
      if (ehPago) {
        const { count } = await supabase
          .from('connections').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
        temConexao = (count || 0) > 0;
      }

      // ===== Com banco (Max): usa transacoes_banco dos ultimos 30 dias =====
      if (ehPago && temConexao) {
        const trinta = new Date();
        trinta.setDate(trinta.getDate() - 30);
        const limite = trinta.toISOString().slice(0, 10);
        // Teto: ate hoje. Parcelas futuras nao entram (#6) - alinha com a dashboard.
        const hoje = new Date().toISOString().slice(0, 10);

        // Junta o nome do banco (connector_name) via conta -> conexao (#2)
        const { data: txs } = await supabase
          .from('transacoes_banco')
          .select('valor, tipo, categoria, descricao, merchant_nome, contas_bancarias(connections(connector_name))')
          .eq('user_id', user.id)
          .gte('data', limite)
          .lte('data', hoje);

        // Normaliza cada debito com o banco de origem
        const debits: DebitoBanco[] = (txs || [])
          .filter((t: { tipo: string | null }) => t.tipo === 'DEBIT')
          .map((t: {
            valor: number | string | null; categoria: string | null;
            descricao: string | null; merchant_nome: string | null; contas_bancarias: unknown;
          }) => {
            const conta = Array.isArray(t.contas_bancarias) ? t.contas_bancarias[0] : t.contas_bancarias;
            const conn = conta && typeof conta === 'object' && 'connections' in conta
              ? (Array.isArray((conta as { connections: unknown }).connections)
                  ? (conta as { connections: unknown[] }).connections[0]
                  : (conta as { connections: unknown }).connections)
              : null;
            const banco = (conn && typeof conn === 'object' && 'connector_name' in conn
              ? String((conn as { connector_name?: string }).connector_name || '')
              : '').trim() || 'Banco';
            return {
              valor: t.valor, categoria: t.categoria,
              descricao: t.descricao, merchant_nome: t.merchant_nome, banco,
            };
          });

        if (debits.length > 0) {
          const listaBancos = Array.from(new Set(debits.map((d) => d.banco))).sort();

          // #2: 2+ bancos -> pergunta qual. 1 banco -> vai direto.
          if (listaBancos.length > 1) {
            setDebitosTodos(debits);
            setBancos(listaBancos);
            setPrecisaEscolher(true);
            setMensagens([
              { role: 'ai', text: 'Vi que voce tem mais de um banco conectado. Sobre qual deles voce quer falar?' },
            ]);
            setDadosTexto(''); // bloqueia ate escolher
            return;
          }

          // 1 banco so: monta direto
          setDadosTexto(montarTextoBanco(debits, `banco ${listaBancos[0]}`));
          return;
        }

        setDadosTexto('O usuario tem banco conectado, mas nao ha transacoes nos ultimos 30 dias.');
        return;
      }

      // ===== Free, ou pago sem banco: usa a ultima fatura analisada =====
      const { data } = await supabase
        .from('faturas')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'analisada')
        .order('analisado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const categorias: Categoria[] = data.categorias ?? [];
        const transacoes: Transacao[] = data.transacoes ?? [];
        let texto = `Fonte: ultima fatura de cartao analisada (PDF).\n`;
        texto += `Total da fatura: R$ ${data.total}\n`;
        texto += `Insight: ${data.insight ?? 'sem insight'}\n`;
        texto += `Gastos por categoria:\n`;
        categorias.forEach((c) => {
          texto += `- ${c.nome}: R$ ${c.valor}\n`;
        });
        if (transacoes.length > 0) {
          texto += `Compras individuais:\n`;
          transacoes.forEach((t) => {
            texto += `- ${t.descricao} (${t.categoria}): R$ ${t.valor}\n`;
          });
        }
        setDadosTexto(texto);
      } else {
        setDadosTexto('O usuario ainda nao analisou nenhuma fatura.');
      }
    }
    carregar();
  }, [router]);

  // rola pro final quando chega mensagem nova
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensagens, pensando]);

  // #2: usuario escolheu um banco -> filtra os debitos e libera o chat
  function escolherBanco(banco: string) {
    const doBanco = debitosTodos.filter((d) => d.banco === banco);
    setDadosTexto(montarTextoBanco(doBanco, `banco ${banco}`));
    setBancoEscolhido(banco);
    setPrecisaEscolher(false);
    setMensagens((m) => [
      ...m,
      { role: 'user', text: banco },
      { role: 'ai', text: `Show! Vou analisar seus gastos do ${banco}. Pode perguntar.` },
    ]);
  }

  async function enviar(texto: string) {
    if (!texto.trim() || pensando) return;
    // #2: enquanto nao escolheu o banco, o chat fica bloqueado
    if (precisaEscolher) return;

    // adiciona a mensagem do usuario na tela
    setMensagens((m) => [...m, { role: 'user', text: texto }]);
    setInput('');
    setPensando(true);

    try {
      // /api/chat exige login: manda o Bearer token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setMensagens((m) => [...m, { role: 'ai', text: 'Sua sessao expirou. Saia e entre de novo para continuar.' }]);
        setPensando(false);
        return;
      }

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ pergunta: texto, dados: dadosTexto }),
      });
      const json = await resp.json();

      // Limite do Free atingido: mostra o upsell
      if (json.limite_atingido) {
        setLimiteAtingido(true);
      }

      const resposta = json.resposta || json.erro || 'Nao consegui responder agora.';
      setMensagens((m) => [...m, { role: 'ai', text: resposta }]);
    } catch {
      setMensagens((m) => [...m, { role: 'ai', text: 'Ops, deu um erro ao falar com a IA. Tenta de novo.' }]);
    } finally {
      setPensando(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div style={{ background: COLORS.dark1, padding: '48px 24px 20px', borderRadius: '0 0 28px 28px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '999px', display: 'grid', placeItems: 'center', background: COLORS.primary }}>
            <Sparkles size={20} color={COLORS.ink} />
          </div>
          <div>
            <h1 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: 0 }}>Menta IA</h1>
            <p style={{ color: COLORS.primaryLight, fontSize: '11px', margin: 0 }}>
              {bancoEscolhido ? `analisando · ${bancoEscolhido}` : 'online · sabe tudo dos seus gastos'}
            </p>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mensagens.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  maxWidth: '80%',
                  borderRadius: '16px',
                  padding: '10px 14px',
                  fontSize: '14px',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? COLORS.primary : 'white',
                  color: COLORS.ink,
                  border: m.role === 'user' ? 'none' : '1px solid #eef2ef',
                  borderBottomRightRadius: m.role === 'user' ? '4px' : '16px',
                  borderBottomLeftRadius: m.role === 'ai' ? '4px' : '16px',
                }}
              >
                {m.text}
              </div>
            </div>
          ))}

          {/* #2: seletor de banco - aparece quando ha 2+ bancos e nada escolhido */}
          {precisaEscolher && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              {bancos.map((b) => (
                <button
                  key={b}
                  onClick={() => escolherBanco(b)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: 'white', border: `1px solid ${COLORS.primary}66`,
                    borderRadius: '14px', padding: '14px 16px', cursor: 'pointer',
                    fontSize: '15px', fontWeight: 600, color: COLORS.ink, textAlign: 'left',
                  }}
                >
                  <Landmark size={18} color={COLORS.primaryMid} />
                  {b}
                </button>
              ))}
            </div>
          )}

          {/* indicador "pensando" */}
          {pensando && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ borderRadius: '16px', padding: '10px 14px', fontSize: '14px', background: 'white', color: COLORS.muted, border: '1px solid #eef2ef' }}>
                Pensando...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upsell de limite (Free) - aparece acima do input quando bate o limite */}
      {limiteAtingido && (
        <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
          <div style={{
            background: 'white', border: `1px solid ${COLORS.primary}66`, borderRadius: '16px',
            padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: COLORS.ink }}>
                Limite de perguntas atingido
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: COLORS.muted }}>
                Vire Premium pra perguntar sem limite.
              </p>
            </div>
            <a
              href="/planos"
              style={{
                background: COLORS.primary, color: COLORS.ink, fontWeight: 700, fontSize: '13px',
                padding: '8px 14px', borderRadius: '999px', textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              Ver planos
            </a>
          </div>
        </div>
      )}

      {/* Sugestoes - some enquanto precisa escolher banco ou bateu o limite */}
      {!precisaEscolher && !limiteAtingido && (
        <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {sugestoes.map((s, i) => (
              <button
                key={i}
                onClick={() => enviar(s)}
                style={{
                  fontSize: '11px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                  flexShrink: 0,
                  cursor: 'pointer',
                  background: 'white',
                  color: COLORS.primaryMid,
                  border: `1px solid ${COLORS.primary}50`,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '0 16px 100px', flexShrink: 0 }}>
        <div style={{ borderRadius: '999px', padding: '6px', display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid #eef2ef' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enviar(input)}
            placeholder={precisaEscolher ? 'Escolha um banco acima...' : 'Pergunta qualquer coisa...'}
            disabled={precisaEscolher}
            style={{ flex: 1, background: 'transparent', padding: '8px 12px', fontSize: '14px', outline: 'none', border: 'none', color: COLORS.ink }}
          />
          <button
            onClick={() => enviar(input)}
            style={{ width: '36px', height: '36px', borderRadius: '999px', display: 'grid', placeItems: 'center', flexShrink: 0, border: 'none', cursor: 'pointer', background: COLORS.primary }}
          >
            <Send size={16} color={COLORS.ink} />
          </button>
        </div>
      </div>
    </div>
  );
}