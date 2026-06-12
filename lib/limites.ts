/**
 * Regras de limite de uso por plano.
 *
 * Fonte unica da verdade pra regua do tier Free, importada tanto pela rota
 * de analise (barreira real, server-side) quanto pela tela de upload
 * (contador informativo + bloqueio cosmetico).
 *
 * Free  = LIMITE_ANALISES_FREE analises de fatura, vitalicio.
 * Premium = ilimitado.
 *
 * MODELO VITALICIO (importante):
 * A contagem NAO conta mais linhas da tabela `faturas`. Ela le a coluna
 * `profiles.analises_vitalicias`, um numero que so SOBE (incrementado pela
 * rota /api/analisar a cada nova analise) e NUNCA diminui. Por isso, deletar
 * uma fatura na aba Gastos nao devolve cota - era a brecha que permitia usar
 * o Free infinitamente (analisar -> deletar -> repetir).
 */
 
import type { SupabaseClient } from '@supabase/supabase-js';
 
// Quantas analises de fatura um usuario Free pode fazer no total (vitalicio).
export const LIMITE_ANALISES_FREE = 5;
 
/**
 * Le quantas analises vitalicias o usuario ja fez (coluna profiles.analises_vitalicias).
 *
 * O terceiro parametro (excetoFaturaId) foi mantido por compatibilidade com
 * chamadores antigos, mas NAO eh mais usado: o contador agora eh um numero
 * fixo no perfil, nao uma contagem de linhas que pudesse incluir a fatura atual.
 *
 * Fail-open: se a leitura falhar (erro transitorio de DB), retorna 0 pra nao
 * bloquear indevidamente um usuario legitimo. O risco (alguem passar do limite
 * num erro raro) eh baixo e preferivel a punir usuario por falha de infra.
 */
export async function contarAnalisesFeitas(
  userId: string,
  supabase: SupabaseClient,
  _excetoFaturaId?: string
): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('analises_vitalicias')
    .eq('id', userId)
    .maybeSingle();
 
  if (error) {
    console.error('[limites] erro lendo analises_vitalicias:', error);
    return 0;
  }
 
  return data?.analises_vitalicias ?? 0;
}