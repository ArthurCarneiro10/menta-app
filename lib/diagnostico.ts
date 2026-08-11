/**
 * Bloco 3 - Diagnostico Financeiro (funcao central).
 *
 * Le os gastos do usuario, chama o Haiku (MESMO cliente OpenRouter do
 * analise-fatura), devolve um diagnostico estruturado e salva no cache
 * (profiles.diagnostico_json / diagnostico_gerado_em).
 *
 * Usada por:
 *  - app/api/diagnostico/route.ts  -> o app pede o diagnostico
 *  - app/api/analisar/route.ts     -> gera na hora da analise + usa o resumo na push
 *
 * IMPORTANTE: o diagnostico gerado e SEMPRE completo. Quem decide o que o Free
 * ve e o ENDPOINT, nao esta funcao. O Free nunca recebe insights/recomendacao.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// Mesmo modelo do analise-fatura (Haiku via OpenRouter). Barato e rapido.
const MODELO_IA = 'anthropic/claude-haiku-4.5';

// Quantos estabelecimentos (agrupados) mandar pra IA. Compacto = barato.
const TOP_MERCHANTS = 30;

export type DiagnosticoInsight = { emoji: string; titulo: string; texto: string };
export type Diagnostico = {
  resumo: string;
  insights: DiagnosticoInsight[];
  recomendacao: string;
};

type Tx = { descricao: string; valor: number; categoria: string };
type CatTotal = { nome: string; valor: number };
type Merchant = { label: string; count: number; total: number; categoria: string };
type Gastos = { total: number; categorias: CatTotal[]; merchants: Merchant[] };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

// Palavras que nao servem como chave (ruido de fatura). Mesma ideia do
// lib/regras-aprendidas / gastos.tsx.
const STOPWORDS = new Set([
  'compra', 'pagamento', 'pag', 'cartao', 'debito', 'credito', 'parcela',
  'ltda', 'me', 'sa', 'eireli', 'br', 'brasil', 'com', 'www', 'app', 'online',
  'pix', 'ted', 'doc', 'tarifa', 'mensalidade',
]);

// Extrai o "merchant" principal da descricao pra agrupar (ex: 8x iFood).
function chaveMerchant(desc: string): string {
  const norm = (desc || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const palavras = norm.split(' ').filter(
    (p) => p.length >= 3 && !STOPWORDS.has(p) && !/^\d+$/.test(p)
  );
  return palavras[0] || norm || 'outros';
}

function reais(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// 1. Carrega os gastos do usuario (mesma logica de gastos/dashboard)
// ---------------------------------------------------------------------------

async function carregarGastos(
  userId: string,
  supabase: SupabaseClient,
): Promise<Gastos | null> {
  const { data: perfil } = await supabase
    .from('profiles')
    .select('plano')
    .eq('id', userId)
    .maybeSingle();
  const plano = (perfil?.plano as string) || 'free';

  let txs: Tx[] = [];

  // Max com banco conectado -> transacoes reais (Open Finance).
  if (plano === 'max') {
    const { count } = await supabase
      .from('connections')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if ((count || 0) > 0) {
      const { data } = await supabase
        .from('transacoes_banco')
        .select('descricao, merchant_nome, valor, categoria, tipo, data')
        .eq('user_id', userId)
        .eq('tipo', 'DEBIT')
        .order('data', { ascending: false })
        .limit(300);

      txs = (data || []).map((t: {
        descricao: string | null; merchant_nome: string | null;
        valor: number | string | null; categoria: string | null;
      }) => ({
        descricao: (t.descricao || t.merchant_nome || 'Sem descricao').trim(),
        valor: num(t.valor),
        categoria: (t.categoria || 'Outros').trim() || 'Outros',
      }));
    }
  }

  // Sem banco (Free/Premium, ou Max sem conexao) -> ultima fatura PDF analisada.
  let categoriasFatura: CatTotal[] | null = null;
  let totalFatura = 0;
  if (txs.length === 0) {
    const { data } = await supabase
      .from('faturas')
      .select('transacoes, categorias, total, analisado_em')
      .eq('user_id', userId)
      .eq('status', 'analisada')
      .order('analisado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      totalFatura = num(data.total);
      if (Array.isArray(data.categorias)) {
        categoriasFatura = (data.categorias as { nome?: string; valor?: unknown }[])
          .map((c) => ({ nome: (c?.nome || 'Outros').trim() || 'Outros', valor: num(c?.valor) }));
      }
      if (Array.isArray(data.transacoes)) {
        txs = (data.transacoes as { descricao?: string; valor?: unknown; categoria?: string }[])
          .map((t) => ({
            descricao: String(t?.descricao || 'Sem descricao').trim(),
            valor: num(t?.valor),
            categoria: String(t?.categoria || 'Outros').trim() || 'Outros',
          }));
      }
    }
  }

  // Nao ha transacao detalhada, mas ha categorias salvas -> diagnostico so por categoria.
  if (txs.length === 0) {
    if (categoriasFatura && categoriasFatura.length > 0) {
      const categorias = categoriasFatura
        .filter((c) => c.valor > 0)
        .sort((a, b) => b.valor - a.valor);
      const total = totalFatura > 0 ? totalFatura : categorias.reduce((a, c) => a + c.valor, 0);
      return { total, categorias, merchants: [] };
    }
    return null; // sem dado nenhum
  }

  // Totais por categoria (a partir das transacoes)
  const mapaCat = new Map<string, number>();
  for (const t of txs) mapaCat.set(t.categoria, (mapaCat.get(t.categoria) || 0) + t.valor);
  const categorias = Array.from(mapaCat.entries())
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor);
  const total = categorias.reduce((a, c) => a + c.valor, 0);

  // Agrupa por estabelecimento (pega padroes: delivery, assinatura, recorrencia)
  const mapaM = new Map<string, Merchant>();
  for (const t of txs) {
    const k = chaveMerchant(t.descricao);
    const cur = mapaM.get(k) || { label: t.descricao || k, count: 0, total: 0, categoria: t.categoria };
    cur.count += 1;
    cur.total += t.valor;
    mapaM.set(k, cur);
  }
  const merchants = Array.from(mapaM.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_MERCHANTS);

  return { total, categorias, merchants };
}

// ---------------------------------------------------------------------------
// 2. Monta o prompt
// ---------------------------------------------------------------------------

function montarPrompt(g: Gastos): string {
  const linhasCat = g.categorias
    .filter((c) => c.valor > 0)
    .map((c) => {
      const pct = g.total > 0 ? Math.round((c.valor / g.total) * 100) : 0;
      return `- ${c.nome}: R$ ${reais(c.valor)} (${pct}%)`;
    })
    .join('\n');

  const linhasMerch = g.merchants.length
    ? g.merchants
        .map((m) => `- ${m.label} | ${m.count}x | R$ ${reais(m.total)} | ${m.categoria}`)
        .join('\n')
    : '(sem detalhe por estabelecimento)';

  return `Voce e um consultor financeiro pessoal da Menta, um app brasileiro. Analise os gastos abaixo e gere um diagnostico curto, util e ACOLHEDOR. Nunca julgue, repreenda ou faca o usuario se sentir mal.

Responda APENAS com um JSON valido, sem nenhum texto antes ou depois, neste formato exato:
{
  "resumo": "uma frase de impacto sobre o gasto mais relevante, SEMPRE com um numero (% ou R$)",
  "insights": [
    { "emoji": "🍔", "titulo": "titulo curto", "texto": "1 a 2 frases explicando o padrao" }
  ],
  "recomendacao": "uma acao pratica, concreta e gentil que a pessoa pode tomar"
}

REGRAS:
- "resumo": 1 frase, a mais util de todas. Sempre com um numero. Ex: "Voce gastou 34% em Alimentacao, seu maior gasto do mes."
- "insights": de 3 a 4 itens. Aponte padroes REAIS dos dados: categoria dominante, delivery (iFood, Rappi, Uber Eats), assinaturas/recorrencia, o estabelecimento que mais aparece, concentracao de gasto. Cada item com um emoji que combine.
- "recomendacao": 1 acao concreta e leve. Nada de sermao ou "corte gastos" generico.
- Portugues do Brasil. Tom de um amigo que entende de dinheiro, nao de um banco.
- Use SO os dados fornecidos. Nao invente valores nem estabelecimentos.

Dados do usuario:
Total gasto: R$ ${reais(g.total)}

Por categoria:
${linhasCat}

Principais estabelecimentos (nome | vezes | total | categoria):
${linhasMerch}`;
}

// ---------------------------------------------------------------------------
// 3. Chama a IA (mesmo cliente/headers do analise-fatura)
// ---------------------------------------------------------------------------

async function chamarIA(prompt: string): Promise<string> {
  const resposta = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.mentaapp.com.br',
      'X-Title': 'Menta App',
    },
    body: JSON.stringify({ model: MODELO_IA, messages: [{ role: 'user', content: prompt }] }),
  });

  if (!resposta.ok) {
    const txt = await resposta.text();
    throw new Error('Erro da IA (diagnostico): ' + txt);
  }
  const dados = await resposta.json();
  return dados.choices?.[0]?.message?.content || '';
}

// ---------------------------------------------------------------------------
// 4. Parse + shape defensivo
// ---------------------------------------------------------------------------

function parseDiagnostico(conteudo: string): Diagnostico {
  const inicio = conteudo.indexOf('{');
  const fim = conteudo.lastIndexOf('}');
  if (inicio === -1 || fim === -1) {
    throw new Error('IA nao retornou JSON no diagnostico');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bruta: any = JSON.parse(conteudo.slice(inicio, fim + 1));

  const insightsBrutos = Array.isArray(bruta?.insights) ? bruta.insights : [];
  const insights: DiagnosticoInsight[] = insightsBrutos
    .slice(0, 4)
    .map((i: { emoji?: string; titulo?: string; texto?: string }) => ({
      emoji: String(i?.emoji || '•').trim() || '•',
      titulo: String(i?.titulo || '').trim(),
      texto: String(i?.texto || '').trim(),
    }))
    .filter((i: DiagnosticoInsight) => i.titulo || i.texto);

  return {
    resumo: String(bruta?.resumo || '').trim(),
    insights,
    recomendacao: String(bruta?.recomendacao || '').trim(),
  };
}

// ---------------------------------------------------------------------------
// 5. Funcao publica: gera, salva no cache e devolve.
//    Retorna null se o usuario nao tem gasto nenhum ainda.
// ---------------------------------------------------------------------------

export async function gerarDiagnostico(
  userId: string,
  supabase: SupabaseClient,
): Promise<Diagnostico | null> {
  const gastos = await carregarGastos(userId, supabase);
  if (!gastos || gastos.total <= 0) return null;

  const prompt = montarPrompt(gastos);
  const conteudo = await chamarIA(prompt);
  const diag = parseDiagnostico(conteudo);

  if (!diag.resumo) {
    throw new Error('Diagnostico veio sem resumo');
  }

  await supabase
    .from('profiles')
    .update({
      diagnostico_json: diag,
      diagnostico_gerado_em: new Date().toISOString(),
    })
    .eq('id', userId);

  return diag;
}