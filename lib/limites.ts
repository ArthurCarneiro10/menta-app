/**
 * Regras de limite de uso por plano.
 *
 * Fonte unica da verdade pra regua do tier Free, importada tanto pela rota
 * de analise (barreira real, server-side) quanto pela tela de upload
 * (contador informativo + bloqueio cosmetico).
 *
 * Free  = LIMITE_ANALISES_FREE analises de fatura, vitalicio.
 * Premium = ilimitado.
 */
 
import type { SupabaseClient } from '@supabase/supabase-js';
 
// Quantas analises de fatura um usuario Free pode fazer no total (vitalicio).
export const LIMITE_ANALISES_FREE = 5;
 
/**
 * Conta quantas faturas distintas o usuario ja analisou (vitalicio).
 *
 * `excetoFaturaId` permite excluir uma fatura da contagem - usado pra que
 * RE-analisar uma fatura ja analisada nao consuma cota nova.
 *
 * Fail-open: se a contagem falhar (erro transitorio de DB), retorna 0 pra
 * nao bloquear indevidamente um usuario legitimo. O risco (alguem passar do
 * limite num erro raro) eh baixo e preferivel a punir usuario por falha de
 * infra.
 */
export async function contarAnalisesFeitas(
  userId: string,
  supabase: SupabaseClient,
  excetoFaturaId?: string
): Promise<number> {
  let query = supabase
    .from('faturas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('analisado_em', 'is', null);
 
  if (excetoFaturaId) {
    query = query.neq('id', excetoFaturaId);
  }
 
  const { count, error } = await query;
 
  if (error) {
    console.error('[limites] erro contando analises:', error);
    return 0;
  }
 
  return count ?? 0;
}