/**
 * Bloco 4 fase 3 - Pontuacao (acumula) + Medalhas (conquistas por marco).
 *
 * A pontuacao e o placar de CONSTANCIA (streak + games + desafios), nunca
 * financeira. Alimenta o ranking. Medalhas sao concedidas automaticamente
 * quando o marco bate (unique constraint impede duplicar).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// Quanto cada coisa vale de pontos.
export const PONTOS = {
  DIA_STREAK: 10,     // por dia de presenca (streak)
  GAME_COMPLETO: 50,  // por game concluido
  DESAFIO_SEMANAL: 80,
};

// Medalhas por numero de games completos.
const MEDALHAS_GAMES = [
  { min: 1, codigo: 'primeiro_game' },
  { min: 5, codigo: 'games_5' },
  { min: 10, codigo: 'games_10' },
];
// Medalhas por streak.
const MEDALHAS_STREAK = [
  { min: 7, codigo: 'streak_7' },
  { min: 30, codigo: 'streak_30' },
  { min: 100, codigo: 'streak_100' },
];

// Soma pontos na pontuacao acumulada do usuario.
export async function adicionarPontos(
  userId: string, supabase: SupabaseClient, pontos: number,
): Promise<void> {
  if (!pontos) return;
  const { data } = await supabase.from('profiles').select('pontuacao').eq('id', userId).maybeSingle();
  const atual = Number(data?.pontuacao || 0);
  await supabase.from('profiles').update({ pontuacao: atual + pontos }).eq('id', userId);
}

// Concede uma medalha (ignora se ja tem, gracas ao unique).
export async function concederMedalha(
  userId: string, supabase: SupabaseClient, codigo: string,
): Promise<void> {
  await supabase.from('medalhas').insert({ user_id: userId, codigo }).select();
  // se ja existir, o unique (user_id, codigo) barra silenciosamente
}

// Marcos de games (chamar quando um game completa).
export async function verificarMarcosGames(userId: string, supabase: SupabaseClient): Promise<void> {
  const { count } = await supabase
    .from('games').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('status', 'completo');
  const n = count || 0;
  for (const m of MEDALHAS_GAMES) {
    if (n >= m.min) await concederMedalha(userId, supabase, m.codigo);
  }
}

// Marcos de streak (chamar no calculo da nota, com o streak do dia).
export async function verificarMarcosStreak(
  userId: string, supabase: SupabaseClient, streak: number,
): Promise<void> {
  for (const m of MEDALHAS_STREAK) {
    if (streak >= m.min) await concederMedalha(userId, supabase, m.codigo);
  }
}