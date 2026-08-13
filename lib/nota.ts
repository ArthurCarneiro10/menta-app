/**
 * Bloco 4 - Nota do dia (calculo).
 *
 * A nota (0-100) e feita SO de pontos positivos - nada subtrai. Gasto
 * necessario e neutro, nunca derruba a nota (filosofia: check-in de saude,
 * nao boletim de gastos).
 *
 * Componentes:
 *   - presenca (abriu o app hoje)       : 40
 *   - consciencia (abriu a aba Gastos)  : 30
 *   - streak (dias seguidos)            : ate 30 (cresce 3/dia, teto 30)
 *   - sinal do dia (SO Max, so bonus)   : +30 se o gasto de hoje esta no normal
 * Teto de 100. Premium chega a 100 so com habitos; Max tem mais caminhos.
 *
 * O cliente NUNCA le a tabela direto - tudo passa pelo /api/nota (gate por plano).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const PT_PRESENCA = 40;
const PT_CONSCIENCIA = 30;
const PT_STREAK_MAX = 30;
const PT_SINAL = 30;

export type NotaComponentes = {
  presenca: boolean;
  consciencia: boolean;
  streakBonus: number;
  dentroDoNormal?: boolean; // so Max
};

export type NotaResultado = {
  nota: number;
  streak: number;
  componentes: NotaComponentes;
  frase: string;
};

export type NotaHistoricoDia = { dia: string; nota: number };

// Busca os ultimos N dias de nota (pro grafico/lista da pagina /nota).
export async function historicoNota(
  userId: string, supabase: SupabaseClient, dias = 14,
): Promise<NotaHistoricoDia[]> {
  const { data } = await supabase
    .from('nota_diaria')
    .select('dia, nota')
    .eq('user_id', userId)
    .order('dia', { ascending: false })
    .limit(dias);
  return ((data || []) as NotaHistoricoDia[]).reverse();
}

// Data de hoje em America/Sao_Paulo (YYYY-MM-DD). Evita o "dia" virar no
// horario errado por causa de UTC.
function dataSP(base = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(base);
}

// Dia anterior a uma data YYYY-MM-DD (usa meio-dia UTC pra nao esbarrar em borda).
function diaAnterior(dia: string): string {
  const d = new Date(dia + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

// Sinal do dia (Max): o gasto de hoje esta dentro do normal do usuario?
// Compara o total gasto hoje com a media diaria dos ultimos 30 dias.
// Nunca pune: nao gastar nada tambem conta como "dentro do normal".
async function sinalDentroDoNormal(
  userId: string, supabase: SupabaseClient, hoje: string,
): Promise<boolean> {
  const desde = (() => {
    const d = new Date(hoje + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - 30);
    return d.toISOString().slice(0, 10);
  })();

  const { data } = await supabase
    .from('transacoes_banco')
    .select('valor, data')
    .eq('user_id', userId)
    .eq('tipo', 'DEBIT')
    .gte('data', desde);

  const rows = (data || []) as { valor: number | string | null; data: string | null }[];
  let hojeTotal = 0;
  let total30 = 0;
  for (const r of rows) {
    const v = num(r.valor);
    total30 += v;
    if (r.data === hoje) hojeTotal += v;
  }
  const mediaDiaria = total30 / 30;
  return hojeTotal === 0 || hojeTotal <= mediaDiaria;
}

function gerarFrase(c: NotaComponentes, streak: number, plano: string): string {
  const premium = plano === 'premium' || plano === 'max';
  if (premium && streak >= 3) return `${streak} dias seguidos! Voce ta constante 🔥`;
  if (c.dentroDoNormal && c.consciencia) return 'De olho nos gastos e tudo tranquilo hoje 🌱';
  if (c.dentroDoNormal) return 'Seu gasto de hoje esta dentro do normal 🌱';
  if (c.consciencia) return 'Voce revisou seus gastos hoje 👏';
  return 'Voce abriu o Menta hoje 👏';
}

/**
 * Registra a acao do dia (abrir / gastos), recalcula nota + streak, salva e
 * devolve. Chamada pelo /api/nota.
 */
export async function registrarNota(
  userId: string,
  supabase: SupabaseClient,
  acao: 'abrir' | 'gastos',
  plano: string,
  temConexao: boolean,
): Promise<NotaResultado> {
  const hoje = dataSP();
  const ontem = diaAnterior(hoje);

  const [{ data: rowHoje }, { data: rowOntem }] = await Promise.all([
    supabase.from('nota_diaria').select('componentes, streak').eq('user_id', userId).eq('dia', hoje).maybeSingle(),
    supabase.from('nota_diaria').select('streak').eq('user_id', userId).eq('dia', ontem).maybeSingle(),
  ]);

  const compAntes = (rowHoje?.componentes || {}) as Partial<NotaComponentes>;

  // Qualquer chamada = a pessoa esta no app hoje.
  const presenca = true;
  const consciencia = !!compAntes.consciencia || acao === 'gastos';

  // Streak: so incrementa na PRIMEIRA acao do dia (quando ainda nao ha registro
  // de hoje). Depois disso, mantem. Se ontem nao tem registro, reseta pra 1.
  const streak = rowHoje
    ? (rowHoje.streak as number)
    : ((rowOntem?.streak as number) || 0) + 1;

  const streakBonus = Math.min(PT_STREAK_MAX, streak * 3);

  let dentroDoNormal: boolean | undefined;
  if (plano === 'max' && temConexao) {
    try {
      dentroDoNormal = await sinalDentroDoNormal(userId, supabase, hoje);
    } catch {
      dentroDoNormal = undefined;
    }
  }

  const componentes: NotaComponentes = { presenca, consciencia, streakBonus, dentroDoNormal };

  let nota = PT_PRESENCA + (consciencia ? PT_CONSCIENCIA : 0) + streakBonus;
  if (dentroDoNormal) nota += PT_SINAL;
  nota = Math.min(100, nota);

  const frase = gerarFrase(componentes, streak, plano);

  await supabase.from('nota_diaria').upsert(
    { user_id: userId, dia: hoje, nota, componentes, streak },
    { onConflict: 'user_id,dia' },
  );

  return { nota, streak, componentes, frase };
}