/**
 * Logica compartilhada de gestao do estado Premium.
 *
 * Centraliza as transicoes Free <-> Premium pra evitar duplicacao entre
 * a rota de cancelamento do usuario, o webhook do MP, e a logica de
 * reativacao no futuro.
 *
 * Nao chama API do Mercado Pago - so atualiza o estado local. Quem
 * cancela no MP eh quem chama essa funcao (ex: /api/cancelar-premium
 * cancela primeiro, dai chama marcarCancelamentoPremium).
 */
 
import type { SupabaseClient } from '@supabase/supabase-js';
 
export const DIAS_GRACE = 30;
 
/**
 * Marca o usuario como Premium ativo.
 * Limpa qualquer flag de cancelamento pendente (caso esteja reativando
 * durante o grace period).
 */
export async function ativarPremium(
  userId: string,
  supabase: SupabaseClient
): Promise<void> {
  await supabase
    .from('profiles')
    .update({
      plano: 'premium',
      cancelado_em: null,
      dados_apagar_em: null,
    })
    .eq('id', userId);
 
  await supabase.from('notificacoes').insert({
    user_id: userId,
    tipo: 'premium_ativado',
    titulo: 'Premium ativado!',
    mensagem:
      'Sua assinatura foi confirmada. Aproveite o Open Finance e todas as funcionalidades Premium do Menta.',
  });
}
 
/**
 * Marca cancelamento do Premium com periodo de graca de 30 dias.
 *
 * Apos esse periodo, /api/limpeza-vencidos limpa os dados bancarios.
 * Se o usuario reativar antes disso (chamando ativarPremium), as flags
 * sao zeradas e o cancelamento eh abortado.
 *
 * Retorna a data de apagamento programada (ISO string) pra UI poder
 * mostrar pro usuario.
 */
export async function marcarCancelamentoPremium(
  userId: string,
  supabase: SupabaseClient
): Promise<{ dataApagarISO: string }> {
  const agora = new Date();
  const dataApagar = new Date(agora);
  dataApagar.setDate(dataApagar.getDate() + DIAS_GRACE);
 
  await supabase
    .from('profiles')
    .update({
      plano: 'free',
      cancelado_em: agora.toISOString(),
      dados_apagar_em: dataApagar.toISOString(),
    })
    .eq('id', userId);
 
  const dataLegivel = dataApagar.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
 
  await supabase.from('notificacoes').insert({
    user_id: userId,
    tipo: 'premium_cancelado',
    titulo: 'Premium cancelado',
    mensagem: `Sua assinatura foi cancelada. Suas conexões bancárias e transações ficam armazenadas por ${DIAS_GRACE} dias caso queira reativar. Após ${dataLegivel}, serão apagadas automaticamente.`,
  });
 
  return { dataApagarISO: dataApagar.toISOString() };
}