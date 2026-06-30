/**
 * Webhook do Mercado Pago.
 *
 * Recebe eventos sobre preapprovals (assinaturas de CARTAO), pagamentos
 * recorrentes, e pagamentos unicos via PIX. Para cada evento relevante,
 * consulta o estado atual no MP e sincroniza o DB local.
 *
 * Eventos tratados:
 *   - subscription_preapproval (assinatura cartao: criada/autorizada/pausada/cancelada)
 *   - subscription_authorized_payment (cobranca recorrente de cartao processada)
 *   - payment (pagamento unico via Pix -> ativa plano anual com validade de 12 meses)
 *
 * Garantias de robustez:
 *   - Cartao: ao autorizar, CURA duplicadas; paused aplica grace de 30 dias.
 *   - Pix: idempotente (nao ativa a mesma ordem duas vezes); so ativa em 'approved'.
 *   - SEMPRE responde 200, mesmo em erro, pra evitar retry infinito do MP.
 *
 * IMPORTANTE: MP nao consegue chamar localhost. Pra testar este endpoint
 * voce precisa ter o app deployado em URL HTTPS publica (Vercel).
 *
 * Env vars opcionais:
 *   MP_WEBHOOK_VERBOSE=true   -> loga body e headers completos (debug)
 *   MP_WEBHOOK_STRICT=true    -> exige HMAC valido (rejeita com 401 se falhar)
 *   MP_WEBHOOK_SECRET=...     -> secret do dashboard MP, usado pra validar HMAC
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getPreapproval, getAuthorizedPayment } from '@/lib/mercadopago';
import { getPagamento } from '@/lib/mercadopago-pix';
import {
  ativarPremium,
  ativarPlanoPix,
  marcarCancelamentoPremium,
  marcarPausaPremium,
} from '@/lib/premium';
import { cancelarAssinaturasVivas } from '@/lib/assinaturas';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VERBOSE = process.env.MP_WEBHOOK_VERBOSE === 'true';
const STRICT = process.env.MP_WEBHOOK_STRICT === 'true';
const WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';

export async function POST(request: Request) {
  try {
    // ===== Le o body cru (necessario pra HMAC validar a mesma string que MP assinou) =====
    const bodyText = await request.text();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(bodyText);
    } catch {
      console.warn('[mp-webhook] body nao eh JSON valido');
    }

    // MP usa tanto "type" quanto "topic" em diferentes endpoints
    const eventType: string =
      (body.type as string) || (body.topic as string) || (body.action as string) || 'unknown';
    const resourceId: string | undefined =
      ((body.data as { id?: string } | undefined)?.id) || (body.resource as string | undefined);

    // Headers de assinatura
    const xSignature = request.headers.get('x-signature') || '';
    const xRequestId = request.headers.get('x-request-id') || '';

    console.log(`[mp-webhook] event=${eventType} resource=${resourceId}`);

    if (VERBOSE) {
      console.log('[mp-webhook] body completo:', bodyText);
      console.log(`[mp-webhook] headers x-signature=${xSignature} x-request-id=${xRequestId}`);
    }

    // ===== HMAC validation =====
    // STRICT off  -> nao valida (modo dev/teste)
    // STRICT on + sem secret -> nao valida mas avisa (config incompleta)
    // STRICT on + com secret -> valida. Falhou? rejeita com 401.
    if (STRICT) {
      if (!WEBHOOK_SECRET) {
        console.warn('[mp-webhook] STRICT=true mas MP_WEBHOOK_SECRET vazio - nao validando');
      } else {
        const validacao = validarAssinaturaMP({
          xSignature,
          xRequestId,
          resourceId: resourceId || '',
          secret: WEBHOOK_SECRET,
        });

        if (!validacao.valido) {
          console.warn(`[mp-webhook] HMAC invalido: ${validacao.motivo}`);
          return NextResponse.json(
            { erro: 'assinatura invalida' },
            { status: 401 }
          );
        }

        if (VERBOSE) {
          console.log('[mp-webhook] HMAC valido');
        }
      }
    }

    if (!resourceId) {
      console.warn('[mp-webhook] body sem data.id, ignorando');
      return NextResponse.json({ recebido: true });
    }

    // ===== Roteamento por tipo =====
    if (
      eventType === 'subscription_preapproval' ||
      eventType.startsWith('subscription_preapproval')
    ) {
      await processarPreapproval(resourceId);
    } else if (eventType === 'subscription_authorized_payment') {
      await processarAuthorizedPayment(resourceId);
    } else if (eventType === 'payment' || eventType.startsWith('payment')) {
      // Pagamento unico (Pix). O cartao recorrente NAO cai aqui - ele vem
      // como subscription_authorized_payment. Aqui so tratamos Pix avulso.
      await processarPagamentoPix(resourceId);
    } else {
      console.log(`[mp-webhook] tipo nao tratado: ${eventType}`);
    }

    return NextResponse.json({ recebido: true });
  } catch (e) {
    console.error('[mp-webhook] erro processando:', e);
    // SEMPRE responde 200, mesmo em erro, pra evitar retry infinito do MP.
    // Se retornarmos 500, MP fica chamando indefinidamente.
    return NextResponse.json({ recebido: true, erro_interno: true });
  }
}

// =========================================================================
// HMAC validation
// =========================================================================

/**
 * Valida a assinatura HMAC enviada pelo Mercado Pago.
 *
 * Formato do header x-signature: "ts=<timestamp>,v1=<hash>"
 * Manifest hasheado: "id:<data.id>;request-id:<x-request-id>;ts:<timestamp>;"
 * Algoritmo: HMAC-SHA256 com o webhook secret como chave.
 *
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
function validarAssinaturaMP(params: {
  xSignature: string;
  xRequestId: string;
  resourceId: string;
  secret: string;
}): { valido: boolean; motivo?: string } {
  const { xSignature, xRequestId, resourceId, secret } = params;

  if (!xSignature || !xRequestId || !resourceId) {
    return { valido: false, motivo: 'headers ou data.id ausentes' };
  }

  // Extrai ts e v1 do header x-signature
  let ts = '';
  let hashRecebido = '';
  for (const part of xSignature.split(',')) {
    const [key, value] = part.split('=', 2);
    const k = key?.trim();
    const v = value?.trim();
    if (k === 'ts') ts = v || '';
    else if (k === 'v1') hashRecebido = v || '';
  }

  if (!ts || !hashRecebido) {
    return { valido: false, motivo: 'x-signature sem ts ou v1' };
  }

  // Manifest e hash
  const manifest = `id:${resourceId};request-id:${xRequestId};ts:${ts};`;
  const hashCalculado = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  // Comparacao timing-safe (protege contra timing attacks)
  try {
    const a = Buffer.from(hashCalculado, 'hex');
    const b = Buffer.from(hashRecebido, 'hex');
    if (a.length !== b.length) {
      return { valido: false, motivo: 'tamanho de hash divergente' };
    }
    if (!crypto.timingSafeEqual(a, b)) {
      return { valido: false, motivo: 'hash nao bate com o manifest' };
    }
    return { valido: true };
  } catch (e) {
    return {
      valido: false,
      motivo: `erro comparando: ${e instanceof Error ? e.message : 'desconhecido'}`,
    };
  }
}

// =========================================================================
// Helpers - CARTAO (preapproval)
// =========================================================================

async function processarPreapproval(preapprovalId: string): Promise<void> {
  // Consulta status atualizado direto no MP (nao confia no body do webhook)
  const preapproval = await getPreapproval(preapprovalId);
  const userId = preapproval.external_reference;

  if (!userId) {
    console.warn(
      `[mp-webhook] preapproval ${preapprovalId} sem external_reference - ignorado`
    );
    return;
  }

  // Pega plano_tipo (ciclo) e nivel da tabela assinaturas (salvos quando criamos
  // a preapproval). Fallback do ciclo: infere pela frequencia. Fallback do
  // nivel: 'premium'.
  let planoTipo: 'mensal' | 'anual' = 'mensal';
  const { data: assinaturaExistente } = await supabase
    .from('assinaturas')
    .select('plano_tipo, nivel')
    .eq('mp_preapproval_id', preapprovalId)
    .maybeSingle();

  if (assinaturaExistente?.plano_tipo === 'anual' || assinaturaExistente?.plano_tipo === 'mensal') {
    planoTipo = assinaturaExistente.plano_tipo;
  } else if (preapproval.auto_recurring.frequency >= 12) {
    planoTipo = 'anual';
  }

  const nivel: 'premium' | 'max' =
    assinaturaExistente?.nivel === 'max' ? 'max' : 'premium';

  console.log(
    `[mp-webhook] preapproval=${preapprovalId} user=${userId} status=${preapproval.status} plano=${planoTipo} nivel=${nivel}`
  );

  // ===== Upsert na tabela assinaturas (espelho do MP) =====
  const { error: upsertError } = await supabase
    .from('assinaturas')
    .upsert(
      {
        user_id: userId,
        mp_preapproval_id: preapproval.id,
        mp_preapproval_plan_id: preapproval.preapproval_plan_id || '',
        plano_tipo: planoTipo,
        nivel,
        valor: preapproval.auto_recurring.transaction_amount,
        status: preapproval.status,
        proximo_pagamento: preapproval.next_payment_date || null,
      },
      { onConflict: 'mp_preapproval_id' }
    );

  if (upsertError) {
    console.error(`[mp-webhook] erro upsert assinaturas:`, upsertError);
  }

  // ===== Sincroniza profiles.plano com o status MP =====
  if (preapproval.status === 'authorized') {
    await ativarPremium(userId, supabase, nivel);
    console.log(`[mp-webhook] user ${userId} virou ${nivel}`);

    // CURA: cancela qualquer outra assinatura viva do user (anti cobranca dupla).
    // Preserva a atual via `exceto`. Tolerante a falha.
    try {
      const curadas = await cancelarAssinaturasVivas(userId, supabase, {
        exceto: preapproval.id,
      });
      if (curadas > 0) {
        console.log(`[mp-webhook] cura: ${curadas} assinatura(s) duplicada(s) cancelada(s)`);
      }
    } catch (e) {
      console.error('[mp-webhook] erro na cura de duplicadas:', e);
    }
  } else if (preapproval.status === 'cancelled') {
    // So aplica grace period se ainda nao foi aplicado (evita re-cancelar
    // se o webhook chegar duplicado)
    const { data: perfil } = await supabase
      .from('profiles')
      .select('plano, cancelado_em')
      .eq('id', userId)
      .single();

    if (perfil?.plano === 'premium' || perfil?.plano === 'max' || !perfil?.cancelado_em) {
      await marcarCancelamentoPremium(userId, supabase);
      console.log(`[mp-webhook] user ${userId} cancelado, grace de 30 dias iniciado`);
    } else {
      console.log(`[mp-webhook] user ${userId} ja estava cancelado, sem dupla acao`);
    }
  } else if (preapproval.status === 'paused') {
    // Cobranca recorrente falhou (cartao recusado). Aplica grace de 30 dias
    // com notificacao propria. Mesma guarda anti-duplicado do cancelamento.
    const { data: perfil } = await supabase
      .from('profiles')
      .select('plano, cancelado_em')
      .eq('id', userId)
      .single();

    if (perfil?.plano === 'premium' || perfil?.plano === 'max' || !perfil?.cancelado_em) {
      await marcarPausaPremium(userId, supabase);
      console.log(`[mp-webhook] user ${userId} pausado (pagamento falhou), grace iniciado`);
    } else {
      console.log(`[mp-webhook] user ${userId} ja em estado de grace, sem dupla acao`);
    }
  } else if (preapproval.status === 'pending') {
    console.log(`[mp-webhook] user ${userId} ainda pending (cadastrando cartao)`);
  }
}

/**
 * Processa o evento subscription_authorized_payment (cobranca recorrente de cartao).
 *
 * O data.id desse evento eh o id da COBRANCA, nao da preapproval. Buscamos
 * o authorized_payment pra descobrir o preapproval_id e dai ressincronizamos
 * a assinatura inteira (status + proximo_pagamento) reusando processarPreapproval.
 */
async function processarAuthorizedPayment(authorizedPaymentId: string): Promise<void> {
  const ap = await getAuthorizedPayment(authorizedPaymentId);

  if (!ap.preapproval_id) {
    console.warn(
      `[mp-webhook] authorized_payment ${authorizedPaymentId} sem preapproval_id - ignorado`
    );
    return;
  }

  console.log(
    `[mp-webhook] cobranca recorrente (payment=${authorizedPaymentId} status=${ap.payment?.status || ap.status || '?'}) -> ressincronizando preapproval ${ap.preapproval_id}`
  );

  // Reusa todo o fluxo de sincronizacao: vai reconsultar o MP, atualizar
  // status + proximo_pagamento, e reativar o plano se preciso.
  await processarPreapproval(ap.preapproval_id);
}

// =========================================================================
// Helpers - PIX (pagamento unico)
// =========================================================================

/**
 * Processa o evento `payment` (pagamento unico via Pix).
 *
 * O data.id eh o id do PAGAMENTO. Consultamos no MP, e so seguimos se
 * status === 'approved'. O external_reference do pagamento aponta pra
 * ordem em pagamentos_pix (gravado quando criamos a preference). Achando
 * a ordem, ativamos o plano com validade de 12 meses.
 *
 * Idempotente: se a ordem ja estiver 'approved', nao reativa.
 * Seguro: se o external_reference nao bater com nenhuma ordem nossa, ignora.
 */
async function processarPagamentoPix(paymentId: string): Promise<void> {
  const pagamento = await getPagamento(paymentId);

  // So ativa pagamento aprovado.
  if (pagamento.status !== 'approved') {
    console.log(
      `[mp-webhook] pagamento ${paymentId} status=${pagamento.status} - ignorado (so ativa em approved)`
    );
    return;
  }

  const ordemId = pagamento.external_reference;
  if (!ordemId) {
    console.warn(`[mp-webhook] pagamento ${paymentId} sem external_reference - ignorado`);
    return;
  }

  // Busca a ordem Pix correspondente.
  const { data: ordem } = await supabase
    .from('pagamentos_pix')
    .select('id, user_id, nivel, status')
    .eq('id', ordemId)
    .maybeSingle();

  if (!ordem) {
    // external_reference nao bate com nenhuma ordem Pix nossa. Pode ser um
    // pagamento de outra origem - ignora com seguranca.
    console.warn(
      `[mp-webhook] pagamento ${paymentId} sem ordem Pix correspondente (ref=${ordemId}) - ignorado`
    );
    return;
  }

  // Idempotencia: nao reativa a mesma ordem.
  if (ordem.status === 'approved') {
    console.log(`[mp-webhook] ordem Pix ${ordem.id} ja estava approved - sem dupla ativacao`);
    return;
  }

  const nivel: 'premium' | 'max' = ordem.nivel === 'max' ? 'max' : 'premium';

  // Validade de 12 meses a partir de agora.
  const agora = new Date();
  const expira = new Date(agora);
  expira.setFullYear(expira.getFullYear() + 1);
  const expiraISO = expira.toISOString();

  // Marca a ordem como paga.
  await supabase
    .from('pagamentos_pix')
    .update({
      status: 'approved',
      mp_payment_id: String(pagamento.id),
      pago_em: agora.toISOString(),
      expira_em: expiraISO,
    })
    .eq('id', ordem.id);

  // Ativa o plano com validade.
  await ativarPlanoPix(ordem.user_id, supabase, nivel, expiraISO);

  console.log(
    `[mp-webhook] Pix aprovado: user ${ordem.user_id} virou ${nivel} ate ${expiraISO}`
  );
}

// GET pra status/debug
export async function GET() {
  return NextResponse.json({
    status: 'mp-webhook endpoint ativo',
    strict: STRICT,
    has_secret: !!WEBHOOK_SECRET,
    verbose: VERBOSE,
  });
}