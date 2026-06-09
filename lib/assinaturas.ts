/**
 * Helpers de gestao da tabela `assinaturas` que cruzam Mercado Pago + DB local.
 *
 * Diferente de lib/premium.ts (que so mexe no estado local), este modulo
 * fala com a API do MP (cancelarPreapproval) e por isso vive separado.
 *
 * Usado por:
 *  - /api/mp/iniciar-assinatura  -> prevencao (limpa pending empilhadas)
 *  - /api/mp/webhook             -> cura (ao autorizar uma, cancela as outras)
 */
 
import type { SupabaseClient } from '@supabase/supabase-js';
import { cancelarPreapproval } from '@/lib/mercadopago';
 
type StatusVivo = 'pending' | 'authorized';
 
/**
 * Cancela no MP e marca como `cancelled` localmente todas as assinaturas
 * vivas de um usuario, opcionalmente preservando uma (`exceto`).
 *
 * Tolerante a falha: se o cancelamento de uma preapproval no MP falhar
 * (ex: ja estava cancelada la), loga e segue. Nunca derruba o fluxo
 * principal de quem chama.
 *
 * Retorna quantas linhas foram efetivamente marcadas cancelled no banco.
 */
export async function cancelarAssinaturasVivas(
  userId: string,
  supabase: SupabaseClient,
  opcoes: { exceto?: string; statuses?: StatusVivo[] } = {}
): Promise<number> {
  const statuses: StatusVivo[] = opcoes.statuses ?? ['pending', 'authorized'];
 
  const { data: vivas, error } = await supabase
    .from('assinaturas')
    .select('mp_preapproval_id, status')
    .eq('user_id', userId)
    .in('status', statuses);
 
  if (error) {
    console.error('[assinaturas] erro buscando vivas:', error);
    return 0;
  }
  if (!vivas || vivas.length === 0) {
    return 0;
  }
 
  let canceladas = 0;
 
  for (const a of vivas) {
    const id = a.mp_preapproval_id as string | null;
    if (!id) continue;
    if (opcoes.exceto && id === opcoes.exceto) continue;
 
    // 1. Cancela no MP (tolerante a falha)
    try {
      await cancelarPreapproval(id);
    } catch (e) {
      console.warn(
        `[assinaturas] falha cancelando ${id} no MP (pode ja estar cancelada):`,
        e instanceof Error ? e.message : e
      );
    }
 
    // 2. Marca cancelled no banco (mesmo se o MP falhou, pra refletir intencao)
    const { error: updErr } = await supabase
      .from('assinaturas')
      .update({ status: 'cancelled' })
      .eq('mp_preapproval_id', id);
 
    if (updErr) {
      console.error(`[assinaturas] erro marcando cancelled local (${id}):`, updErr);
    } else {
      canceladas++;
    }
  }
 
  return canceladas;
}