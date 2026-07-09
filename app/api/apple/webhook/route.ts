/**
 * POST /api/apple/webhook
 *
 * Recebe App Store Server Notifications V2 (renovacao, cancelamento,
 * expiracao, reembolso). Espelha o /api/mp/webhook, com as mesmas garantias:
 *
 *  - NUNCA confia no body: extrai o transactionId e RECONSULTA a Apple.
 *  - Idempotente: reprocessar a mesma notificacao nao causa dupla acao.
 *  - SEMPRE responde 200 (a Apple faz retry agressivo se receber erro).
 *
 * Configure a URL desta rota em:
 *   App Store Connect > seu app > Informacoes do app >
 *   App Store Server Notifications > URL de producao / sandbox
 *
 * Reusa ativarPremium e marcarCancelamentoPremium de lib/premium.ts -
 * as MESMAS funcoes que o Mercado Pago usa. Assim um assinante Apple e um
 * assinante MP terminam exatamente no mesmo estado.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStatusAssinatura, decodificarJWS, produtoParaPlano, ambienteAtual } from '@/lib/apple-iap';
import { ativarPremium, marcarCancelamentoPremium } from '@/lib/premium';

export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VERBOSE = process.env.APPLE_WEBHOOK_VERBOSE === 'true';

// Payload externo da notificacao V2
type NotificacaoV2 = {
  notificationType: string;
  subtype?: string;
  data?: {
    bundleId?: string;
    environment?: string;
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const signedPayload: string | undefined = body?.signedPayload;

    if (!signedPayload) {
      console.warn('[apple-webhook] body sem signedPayload');
      return NextResponse.json({ recebido: true });
    }

    // Decodifica so pra descobrir QUAL transacao consultar.
    // A verdade vem da reconsulta logo abaixo.
    const notificacao = decodificarJWS<NotificacaoV2>(signedPayload);
    const tipo = notificacao.notificationType;
    const subtipo = notificacao.subtype || '';

    console.log(`[apple-webhook] tipo=${tipo} subtipo=${subtipo}`);
    if (VERBOSE) console.log('[apple-webhook] payload:', JSON.stringify(notificacao));

    const signedTx = notificacao.data?.signedTransactionInfo;
    if (!signedTx) {
      console.log('[apple-webhook] notificacao sem transacao - ignorada');
      return NextResponse.json({ recebido: true });
    }

    const txPreview = decodificarJWS<{ transactionId?: string; originalTransactionId?: string }>(signedTx);
    const transactionId = txPreview.transactionId || txPreview.originalTransactionId;

    if (!transactionId) {
      console.warn('[apple-webhook] transacao sem id - ignorada');
      return NextResponse.json({ recebido: true });
    }

    await processarNotificacao(tipo, transactionId);

    return NextResponse.json({ recebido: true });
  } catch (e) {
    console.error('[apple-webhook] erro processando:', e);
    // SEMPRE 200: erro 5xx faz a Apple retentar por dias.
    return NextResponse.json({ recebido: true, erro_interno: true });
  }
}

/**
 * Roteia por tipo de notificacao, sempre reconsultando a Apple antes de agir.
 *
 * Tipos que importam:
 *   SUBSCRIBED / DID_RENEW / DID_CHANGE_RENEWAL_STATUS(auto-renew on)
 *     -> reativa o plano
 *   EXPIRED / GRACE_PERIOD_EXPIRED / REVOKE / REFUND
 *     -> vira Free com grace de 30 dias
 *   DID_FAIL_TO_RENEW
 *     -> se entrou em grace period, mantem acesso; senao, derruba
 */
async function processarNotificacao(tipo: string, transactionId: string): Promise<void> {
  // FONTE DA VERDADE
  const status = await getStatusAssinatura(transactionId);
  const { transacao, ativa } = status;

  const userId = transacao.appAccountToken;
  if (!userId) {
    console.warn(
      `[apple-webhook] transacao ${transactionId} sem appAccountToken - nao da pra identificar o usuario`
    );
    return;
  }

  const plano = produtoParaPlano(transacao.productId);
  if (!plano) {
    console.error(`[apple-webhook] productId desconhecido: ${transacao.productId}`);
    return;
  }

  const expiraEmISO = transacao.expiresDate
    ? new Date(transacao.expiresDate).toISOString()
    : null;

  // Espelha o estado atual na tabela assinaturas.
  await supabase.from('assinaturas').upsert(
    {
      user_id: userId,
      origem: 'apple',
      apple_original_transaction_id: transacao.originalTransactionId,
      apple_product_id: transacao.productId,
      apple_expira_em: expiraEmISO,
      plano_tipo: plano.ciclo,
      nivel: plano.nivel,
      valor: plano.valor,
      status: ativa ? 'authorized' : 'cancelled',
      proximo_pagamento: expiraEmISO,
    },
    { onConflict: 'apple_original_transaction_id' }
  );

  // Reembolso/revogacao derruba na hora, independente do status.
  if (transacao.revocationDate) {
    await derrubarSeNecessario(userId, `reembolso (${tipo})`);
    return;
  }

  if (ativa) {
    // status 1 (ativa) ou 4 (grace period) -> mantem/reativa o acesso.
    // ativarPremium eh idempotente: zera flags de cancelamento se houver.
    await ativarPremium(userId, supabase, plano.nivel);
    console.log(`[apple-webhook] user ${userId} ativo como ${plano.nivel} (${tipo})`);
    return;
  }

  // Nao esta ativa: expirou, foi cancelada, ou falhou a cobranca sem grace.
  await derrubarSeNecessario(userId, tipo);
}

/**
 * Vira Free com grace de 30 dias, mas so se ainda nao estiver nesse estado.
 * Guarda anti-duplicado igual a do webhook do MP.
 */
async function derrubarSeNecessario(userId: string, motivo: string): Promise<void> {
  const { data: perfil } = await supabase
    .from('profiles')
    .select('plano, cancelado_em')
    .eq('id', userId)
    .single();

  if (perfil?.plano === 'premium' || perfil?.plano === 'max' || !perfil?.cancelado_em) {
    await marcarCancelamentoPremium(userId, supabase);
    console.log(`[apple-webhook] user ${userId} virou free (${motivo}), grace de 30 dias`);
  } else {
    console.log(`[apple-webhook] user ${userId} ja estava free (${motivo}), sem dupla acao`);
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'apple-webhook endpoint ativo',
    ambiente: ambienteAtual(),
    verbose: VERBOSE,
  });
}