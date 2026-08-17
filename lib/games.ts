/**
 * Bloco 4 fase 2 - Games (logica).
 *
 * - sugerirGames: olha os gastos do usuario e sugere desafios (delivery, cafe,
 *   categoria top). Regras simples (sem IA), reusando a deteccao de padroes.
 * - GAMES_PRONTOS: lista de prateleira pra escolher.
 * - criarGame: inicia um game (calcula fim + meta pra economizar).
 * - listarComProgresso: lista os games e, pro Max, atualiza o progresso ao vivo
 *   (evitar: falhou se apareceu o gasto; economizar: gasto atual vs meta).
 *
 * Rastreamento por plano:
 *   - Max: dados do banco (transacoes_banco), dia a dia.
 *   - Premium: avaliado na fatura (onda 4, no /api/analisar).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { adicionarPontos, verificarMarcosGames, PONTOS } from './gamificacao';

export type TipoGame = 'evitar' | 'economizar';
export type StatusGame = 'ativo' | 'completo' | 'falhou' | 'expirado';

export type Game = {
  id: string;
  tipo: TipoGame;
  alvo: string;
  titulo: string;
  duracao_dias: number | null;
  inicio: string;
  fim: string | null;
  status: StatusGame;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  progresso: any;
};

export type Sugestao = {
  tipo: TipoGame;
  alvo: string;
  titulo: string;
  motivo: string;
  duracaoDias: number;
};

type Tx = { descricao: string; valor: number; categoria: string; data: string | null };

// Padroes detectaveis por texto da transacao (alem das 9 categorias).
const PADROES: { alvo: string; label: string; termos: string[] }[] = [
  { alvo: 'delivery', label: 'delivery', termos: ['ifood', 'rappi', 'uber eats', 'ubereats', 'delivery', '99food', 'zedelivery'] },
  { alvo: 'cafe', label: 'cafezinho', termos: ['starbucks', 'cafe', 'coffee', 'cafeteria', 'kopenhagen'] },
  { alvo: 'transporte_app', label: 'corridas de app', termos: ['uber', '99', 'cabify', '99pop'] },
];

// ---- helpers ----
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.abs(n) : 0;
}
function normalizar(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function dataSP(base = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(base);
}
function somaDias(dia: string, n: number): string {
  const d = new Date(dia + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Uma transacao "casa" com o alvo do game? (padrao por texto, categoria, ou
// texto livre do game personalizado casando pela descricao)
function casaAlvo(t: Tx, alvo: string): boolean {
  const padrao = PADROES.find((p) => p.alvo === alvo);
  if (padrao) {
    const d = normalizar(t.descricao);
    return padrao.termos.some((termo) => d.includes(termo));
  }
  if (t.categoria === alvo) return true;
  // alvo livre (game personalizado): casa se a descricao contem o texto.
  const alvoNorm = normalizar(alvo);
  return alvoNorm.length >= 3 && normalizar(t.descricao).includes(alvoNorm);
}

// Le transacoes recentes (Max: banco; senao: ultima fatura PDF).
async function lerTransacoes(
  userId: string, supabase: SupabaseClient, plano: string, temConexao: boolean,
): Promise<Tx[]> {
  if (plano === 'max' && temConexao) {
    const desde = somaDias(dataSP(), -60);
    const { data } = await supabase
      .from('transacoes_banco')
      .select('descricao, merchant_nome, valor, categoria, data')
      .eq('user_id', userId)
      .eq('tipo', 'DEBIT')
      .gte('data', desde)
      .order('data', { ascending: false })
      .limit(500);
    return (data || []).map((t: {
      descricao: string | null; merchant_nome: string | null;
      valor: number | string | null; categoria: string | null; data: string | null;
    }) => ({
      descricao: (t.descricao || t.merchant_nome || '').trim(),
      valor: num(t.valor),
      categoria: (t.categoria || 'Outros').trim() || 'Outros',
      data: t.data || null,
    }));
  }

  // Premium/sem banco -> ultima fatura analisada
  const { data } = await supabase
    .from('faturas')
    .select('transacoes')
    .eq('user_id', userId)
    .eq('status', 'analisada')
    .order('analisado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  const txs = Array.isArray(data?.transacoes) ? data!.transacoes : [];
  return (txs as { descricao?: string; valor?: unknown; categoria?: string }[]).map((t) => ({
    descricao: String(t?.descricao || '').trim(),
    valor: num(t?.valor),
    categoria: String(t?.categoria || 'Outros').trim() || 'Outros',
    data: null,
  }));
}

function reais(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// +15 na nota do dia ao completar um game (teto 100).
const BONUS_GAME = 15;

// Da o bonus de game completo na nota_diaria de hoje (some ao total, teto 100).
// Guarda em componentes.bonusGame pra o /api/nota preservar no recalculo.
async function darBonusNota(userId: string, supabase: SupabaseClient): Promise<void> {
  const hoje = dataSP();
  const { data: row } = await supabase
    .from('nota_diaria').select('nota, componentes, streak')
    .eq('user_id', userId).eq('dia', hoje).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comp: any = row?.componentes || {};
  const bonusAntes = Number(comp.bonusGame || 0);
  const bonusNovo = bonusAntes + BONUS_GAME;
  const notaBase = Number(row?.nota || 0) - bonusAntes; // tira o bonus antigo
  const novaNota = Math.min(100, notaBase + bonusNovo);
  await supabase.from('nota_diaria').upsert(
    {
      user_id: userId, dia: hoje, nota: novaNota,
      componentes: { ...comp, bonusGame: bonusNovo }, streak: Number(row?.streak || 0),
    },
    { onConflict: 'user_id,dia' },
  );

  // Fase 3: pontos de constancia + medalhas por completar um game.
  await adicionarPontos(userId, supabase, PONTOS.GAME_COMPLETO);
  await verificarMarcosGames(userId, supabase);
}

// Avalia UM game contra as transacoes do periodo. Retorna status + progresso.
// avaliaFinal = true (Premium/fatura, ou prazo acabou) forca completo/falhou.
function avaliarUm(
  g: Game, doPeriodo: Tx[], hoje: string, avaliaFinal: boolean,
): { status: StatusGame; progresso: Game['progresso'] } {
  if (g.tipo === 'evitar') {
    // Preenche a cartela dia a dia (Max): cada dia sem o gasto vira quadrado.
    // Falha no primeiro dia em que o gasto aparecer.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dias: any = { ...(g.progresso?.dias || {}) };
    const limite = g.fim && hoje > g.fim ? g.fim : hoje;
    let falhou = false;
    let d = g.inicio;
    while (d <= limite) {
      const doDia = doPeriodo.filter((t) => t.data === d);
      if (doDia.some((t) => casaAlvo(t, g.alvo))) { falhou = true; break; }
      dias[d] = true;
      d = somaDias(d, 1);
    }
    let status: StatusGame = 'ativo';
    if (falhou) status = 'falhou';
    else if (avaliaFinal) status = 'completo';
    return { status, progresso: { ...(g.progresso || {}), dias } };
  }
  // economizar
  const gastoAtual = doPeriodo.filter((t) => casaAlvo(t, g.alvo)).reduce((acc, t) => acc + t.valor, 0);
  const meta = Number(g.progresso?.meta || 0);
  let status: StatusGame = 'ativo';
  if (avaliaFinal) status = gastoAtual <= meta ? 'completo' : 'falhou';
  return { status, progresso: { ...(g.progresso || {}), gasto_atual: Math.round(gastoAtual * 100) / 100, meta } };
}

// Avalia os games ATIVOS do usuario. contexto:
//   'max'    -> dia a dia (banco); completa so quando o prazo acaba.
//   'fatura' -> Premium; avalia contra a fatura recem-analisada (uma checagem).
export async function avaliarGames(
  userId: string, supabase: SupabaseClient, plano: string, temConexao: boolean,
  contexto: 'max' | 'fatura',
): Promise<void> {
  const { data } = await supabase
    .from('games')
    .select('id, tipo, alvo, titulo, duracao_dias, inicio, fim, status, progresso')
    .eq('user_id', userId)
    .eq('status', 'ativo');
  const ativos = (data || []) as Game[];
  if (ativos.length === 0) return;

  const txs = await lerTransacoes(userId, supabase, plano, temConexao);
  const hoje = dataSP();
  let completou = false;

  for (const g of ativos) {
    const doPeriodo = contexto === 'max'
      ? txs.filter((t) => t.data && t.data >= g.inicio)
      : txs; // fatura inteira e o periodo pro Premium
    const acabou = g.fim ? hoje >= g.fim : false;
    // Premium/fatura: sempre avalia final (uma checagem na fatura nova).
    const avaliaFinal = contexto === 'fatura' || acabou;

    const r = avaliarUm(g, doPeriodo, hoje, avaliaFinal);
    const mudouStatus = r.status !== g.status;
    const mudouProg = JSON.stringify(r.progresso) !== JSON.stringify(g.progresso || {});

    if (mudouStatus || mudouProg) {
      await supabase.from('games').update({ status: r.status, progresso: r.progresso }).eq('id', g.id);
    }
    if (r.status === 'completo') completou = true;
  }

  if (completou) await darBonusNota(userId, supabase);
}

// Auto-report diario do Premium: marca hoje como mantido (ou falha o game).
export async function reportarDia(
  userId: string, supabase: SupabaseClient, gameId: string, manteve: boolean,
): Promise<Game | null> {
  const { data } = await supabase
    .from('games')
    .select('id, tipo, alvo, titulo, duracao_dias, inicio, fim, status, progresso')
    .eq('id', gameId).eq('user_id', userId).eq('status', 'ativo')
    .maybeSingle();
  if (!data) return null;
  const g = data as Game;
  const hoje = dataSP();

  if (!manteve) {
    await supabase.from('games').update({ status: 'falhou' }).eq('id', g.id);
    return { ...g, status: 'falhou' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dias: any = { ...(g.progresso?.dias || {}) };
  dias[hoje] = true;

  const totalDias = g.duracao_dias || 0;
  const marcados = Object.keys(dias).length;
  const acabou = (g.fim ? hoje >= g.fim : false) || marcados >= totalDias;
  const status: StatusGame = acabou ? 'completo' : 'ativo';

  await supabase.from('games')
    .update({ status, progresso: { ...(g.progresso || {}), dias } })
    .eq('id', g.id);

  if (status === 'completo') await darBonusNota(userId, supabase);
  return { ...g, status, progresso: { ...(g.progresso || {}), dias } };
}
// Games ativos que ainda NAO foram reportados hoje (pro pop-up do Premium).
export async function gamesParaReportar(
  userId: string, supabase: SupabaseClient,
): Promise<Game[]> {
  const { data } = await supabase
    .from('games')
    .select('id, tipo, alvo, titulo, duracao_dias, inicio, fim, status, progresso')
    .eq('user_id', userId).eq('status', 'ativo');
  const hoje = dataSP();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data || []) as Game[]).filter((g) => !((g.progresso as any)?.dias || {})[hoje]);
}

// ---- sugestoes personalizadas ----
export async function sugerirGames(
  userId: string, supabase: SupabaseClient, plano: string, temConexao: boolean,
  alvosOcupados: string[] = [],
): Promise<Sugestao[]> {
  const txs = await lerTransacoes(userId, supabase, plano, temConexao);
  if (txs.length === 0) return [];

  const sugestoes: Sugestao[] = [];

  // 1) padroes por texto (delivery, cafe, app)
  for (const p of PADROES) {
    if (alvosOcupados.includes(p.alvo)) continue;
    const total = txs.filter((t) => casaAlvo(t, p.alvo)).reduce((s, t) => s + t.valor, 0);
    if (total >= 50) {
      const dias = p.alvo === 'delivery' ? 15 : 15;
      sugestoes.push({
        tipo: 'evitar',
        alvo: p.alvo,
        titulo: `${dias} dias sem ${p.label}`,
        motivo: `Voce gastou R$ ${reais(total)} com ${p.label}. Bora dar um tempo?`,
        duracaoDias: dias,
      });
    }
  }

  // 2) categoria que mais gastou -> economizar
  const mapaCat = new Map<string, number>();
  for (const t of txs) mapaCat.set(t.categoria, (mapaCat.get(t.categoria) || 0) + t.valor);
  const topCat = Array.from(mapaCat.entries()).sort((a, b) => b[1] - a[1])[0];
  if (topCat && topCat[1] >= 100 && !alvosOcupados.includes(topCat[0])) {
    sugestoes.push({
      tipo: 'economizar',
      alvo: topCat[0],
      titulo: `Gaste menos em ${topCat[0]}`,
      motivo: `${topCat[0]} foi seu maior gasto (R$ ${reais(topCat[1])}). Que tal segurar um pouco?`,
      duracaoDias: 30,
    });
  }

  return sugestoes.slice(0, 3);
}

// ---- lista de prateleira ----
export const GAMES_PRONTOS: Sugestao[] = [
  { tipo: 'evitar', alvo: 'delivery', titulo: '15 dias sem delivery', motivo: 'Cozinhe mais em casa e sinta a diferenca.', duracaoDias: 15 },
  { tipo: 'evitar', alvo: 'cafe', titulo: '15 dias sem cafezinho fora', motivo: 'Faca em casa e economize sem perceber.', duracaoDias: 15 },
  { tipo: 'economizar', alvo: 'Compras', titulo: 'Gaste menos em Compras', motivo: 'Segure as comprinhas por impulso este mes.', duracaoDias: 30 },
  { tipo: 'economizar', alvo: 'Lazer', titulo: 'Gaste menos em Lazer', motivo: 'Curta de graca e guarde uma grana.', duracaoDias: 30 },
];

// ---- criar ----
export async function criarGame(
  userId: string, supabase: SupabaseClient,
  s: { tipo: TipoGame; alvo: string; titulo: string; duracaoDias: number },
  plano: string, temConexao: boolean,
): Promise<Game | null> {
  // Trava anti-duplicata: se ja ha um game ATIVO com o mesmo alvo, nao cria de
  // novo - devolve o que ja existe.
  const { data: existente } = await supabase
    .from('games')
    .select('id, tipo, alvo, titulo, duracao_dias, inicio, fim, status, progresso')
    .eq('user_id', userId)
    .eq('alvo', s.alvo)
    .eq('status', 'ativo')
    .limit(1)
    .maybeSingle();
  if (existente) return existente as Game;

  const inicio = dataSP();
  const fim = somaDias(inicio, s.duracaoDias);

  // Cartela: mapa de dias mantidos { 'YYYY-MM-DD': true }. Max preenche pelo
  // banco; Premium pelo auto-report.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let progresso: any = { dias: {} };

  // economizar: calcula a "meta" (o quanto gastou no periodo anterior) pra bater.
  if (s.tipo === 'economizar') {
    const txs = await lerTransacoes(userId, supabase, plano, temConexao);
    const anteriorInicio = somaDias(inicio, -s.duracaoDias);
    const gastoAnterior = txs
      .filter((t) => casaAlvo(t, s.alvo) && (!t.data || t.data >= anteriorInicio))
      .reduce((acc, t) => acc + t.valor, 0);
    progresso = { dias: {}, meta: Math.round(gastoAnterior * 100) / 100, gasto_atual: 0 };
  }

  const { data, error } = await supabase
    .from('games')
    .insert({
      user_id: userId,
      tipo: s.tipo,
      alvo: s.alvo,
      titulo: s.titulo,
      duracao_dias: s.duracaoDias,
      inicio,
      fim,
      status: 'ativo',
      progresso,
    })
    .select('id, tipo, alvo, titulo, duracao_dias, inicio, fim, status, progresso')
    .single();

  if (error) return null;
  return data as Game;
}

// ---- listar + progresso ao vivo (Max) ----
export async function listarComProgresso(
  userId: string, supabase: SupabaseClient, plano: string, temConexao: boolean,
): Promise<Game[]> {
  // Max: avalia ao vivo antes de listar (atualiza status/progresso no banco).
  // Premium: nao avalia aqui - so na fatura (analisar).
  if (plano === 'max' && temConexao) {
    await avaliarGames(userId, supabase, plano, temConexao, 'max');
  }

  const { data } = await supabase
    .from('games')
    .select('id, tipo, alvo, titulo, duracao_dias, inicio, fim, status, progresso')
    .eq('user_id', userId)
    .order('criado_em', { ascending: false })
    .limit(20);

  return (data || []) as Game[];
}