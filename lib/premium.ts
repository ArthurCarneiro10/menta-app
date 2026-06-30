/**
 * Logica compartilhada de gestao do estado dos planos pagos.
 *
 * Centraliza as transicoes Free <-> Premium/Max pra evitar duplicacao entre
 * a rota de cancelamento do usuario, o webhook do MP, e a logica de
 * reativacao no futuro.
 *
 * Nao chama API do Mercado Pago - so atualiza o estado local. Quem
 * cancela no MP eh quem chama essa funcao (ex: /api/cancelar-premium
 * cancela primeiro, dai chama marcarCancelamentoPremium).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const DIAS_GRACE = 30;

// Niveis pagos que o ativarPremium aceita.
export type NivelPago = 'premium' | 'max';

/**
 * Marca o usuario como plano pago ativo (premium OU max, conforme comprado).
 * Limpa qualquer flag de cancelamento pendente (caso esteja reativando
 * durante o grace period). Isso tambem cobre a recuperacao de uma pausa
 * por falha de pagamento: cartao volta -> authorized -> flags zeradas.
 *
 * O parametro `nivel` define o que vai no profiles.plano. Default 'premium'
 * pra compatibilidade com chamadas antigas.
 *
 * USADO PELO CARTAO (recorrencia). NAO mexe em plano_expira_em - cartao nao
 * tem validade fixa (quem controla o fim eh o MP via webhook).
 */
export async function ativarPremium(
  userId: string,
  supabase: SupabaseClient,
  nivel: NivelPago = 'premium'
): Promise<void> {
  await supabase
    .from('profiles')
    .update({
      plano: nivel,
      cancelado_em: null,
      dados_apagar_em: null,
    })
    .eq('id', userId);

  const nome = nivel === 'max' ? 'Max' : 'Premium';
  const mensagem =
    nivel === 'max'
      ? 'Sua assinatura Max foi confirmada. Aproveite o Open Finance e todas as funcionalidades do Menta.'
      : 'Sua assinatura Premium foi confirmada. Agora voce tem analise de faturas e IA ilimitadas no Menta.';

  await supabase.from('notificacoes').insert({
    user_id: userId,
    tipo: 'premium_ativado',
    titulo: `${nome} ativado!`,
    mensagem,
  });
}

/**
 * Marca cancelamento do plano pago com periodo de graca de 30 dias.
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
    titulo: 'Assinatura cancelada',
    mensagem: `Sua assinatura foi cancelada. Suas conexões bancárias e transações ficam armazenadas por ${DIAS_GRACE} dias caso queira reativar. Após ${dataLegivel}, serão apagadas automaticamente.`,
  });

  return { dataApagarISO: dataApagar.toISOString() };
}

/**
 * Marca uma pausa por falha de pagamento (cartao recusado numa cobranca
 * recorrente -> status 'paused' no MP).
 *
 * Aplica a MESMA carencia de 30 dias do cancelamento voluntario (o cron
 * /api/limpeza-vencidos trata igual), mas com notificacao propria pedindo
 * atualizacao do cartao - sem mentir dizendo que foi "cancelada".
 *
 * Recuperacao eh automatica: se o cartao voltar a funcionar e a assinatura
 * virar authorized de novo, ativarPremium zera as flags e aborta a carencia.
 */
export async function marcarPausaPremium(
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
    tipo: 'pagamento_pendente',
    titulo: 'Pagamento pendente',
    mensagem: `Não conseguimos processar a cobrança da sua assinatura. Atualize seu cartão para manter seu plano ativo. Seus dados ficam guardados por ${DIAS_GRACE} dias (até ${dataLegivel}) caso prefira reativar mais tarde.`,
  });

  return { dataApagarISO: dataApagar.toISOString() };
}

/**
 * Ativa um plano pago comprado via PIX (pagamento unico, plano anual).
 *
 * Diferente do cartao: aqui NAO ha recorrencia. O acesso vale ate
 * `expiraEmISO` (12 meses a partir do pagamento), gravado em
 * profiles.plano_expira_em. Um cron diario (/api/pix/expirar-vencidos)
 * devolve pro Free quem passar dessa data.
 *
 * `plano_expira_em` preenchido eh justamente o que diferencia um plano
 * Pix (tem validade) de um plano cartao (expira_em NULL, MP gerencia).
 */
export async function ativarPlanoPix(
  userId: string,
  supabase: SupabaseClient,
  nivel: NivelPago,
  expiraEmISO: string
): Promise<void> {
  await supabase
    .from('profiles')
    .update({
      plano: nivel,
      cancelado_em: null,
      dados_apagar_em: null,
      plano_expira_em: expiraEmISO,
    })
    .eq('id', userId);

  const nome = nivel === 'max' ? 'Max' : 'Premium';
  const dataLegivel = new Date(expiraEmISO).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  await supabase.from('notificacoes').insert({
    user_id: userId,
    tipo: 'premium_ativado',
    titulo: `${nome} ativado!`,
    mensagem: `Seu pagamento via Pix foi confirmado. Você tem ${nome} até ${dataLegivel}. Vamos te avisar por email perto do vencimento para renovar.`,
  });
}


/**
 * Expira planos pagos via PIX que passaram da validade (plano_expira_em < now).
 *
 * Roda no cron diario /api/pix/expirar-vencidos. Para cada usuario vencido,
 * reusa marcarCancelamentoPremium: vira Free + grace de 30 dias. Dai o cron
 * /api/limpeza-vencidos cuida da faxina dos dados bancarios depois do grace.
 *
 * So pega quem tem plano_expira_em preenchido (Pix). Cartao tem expira_em NULL,
 * entao nunca cai aqui (quem expira cartao eh o webhook do MP).
 *
 * Retorna quantos foram expirados.
 */
export async function expirarPlanosPixVencidos(
  supabase: SupabaseClient
): Promise<{ expirados: number; erros: string[] }> {
  const agora = new Date().toISOString();
  const erros: string[] = [];

  // Quem ainda esta marcado como pago, mas com validade Pix no passado.
  const { data: vencidos, error } = await supabase
    .from('profiles')
    .select('id')
    .in('plano', ['premium', 'max'])
    .lt('plano_expira_em', agora)
    .not('plano_expira_em', 'is', null);

  if (error) {
    return { expirados: 0, erros: ['busca falhou: ' + error.message] };
  }
  if (!vencidos || vencidos.length === 0) {
    return { expirados: 0, erros: [] };
  }

  let expirados = 0;
  for (const v of vencidos) {
    try {
      // Vira Free + grace de 30 dias (mesma logica do cancelamento de cartao).
      await marcarCancelamentoPremium(v.id, supabase);
      // Limpa a validade Pix pra nao reprocessar no proximo dia.
      await supabase
        .from('profiles')
        .update({ plano_expira_em: null })
        .eq('id', v.id);
      expirados++;
    } catch (e) {
      erros.push(`user=${v.id}: ${e instanceof Error ? e.message : 'desconhecido'}`);
    }
  }

  return { expirados, erros };
}