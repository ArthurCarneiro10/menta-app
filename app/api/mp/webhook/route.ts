/**
 * Webhook do Mercado Pago.
 *
 * Recebe eventos sobre preapprovals (assinaturas) e pagamentos recorrentes.
 * Para cada evento relevante, consulta o estado atual no MP e sincroniza
 * o DB local (tabelas assinaturas + profiles).
 *
 * Eventos tratados:
 *   - subscription_preapproval (criada/autorizada/cancelada)
 *   - subscription_authorized_payment (cobranca recorrente processada)
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
import { getPreapproval } from '@/lib/mercadopago';
import { ativarPremium, marcarCancelamentoPremium } from '@/lib/premium';
 
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
      console.log('[mp-webhook] cobranca recorrente processada');
      // Por enquanto so loga. Futuramente: atualizar proximo_pagamento
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
// Helpers
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
 
  // Pega plano_tipo da tabela assinaturas (foi salvo quando criamos a preapproval).
  // Fallback: infere pela frequencia.
  let planoTipo: 'mensal' | 'anual' = 'mensal';
  const { data: assinaturaExistente } = await supabase
    .from('assinaturas')
    .select('plano_tipo')
    .eq('mp_preapproval_id', preapprovalId)
    .maybeSingle();
 
  if (assinaturaExistente?.plano_tipo === 'anual' || assinaturaExistente?.plano_tipo === 'mensal') {
    planoTipo = assinaturaExistente.plano_tipo;
  } else if (preapproval.auto_recurring.frequency >= 12) {
    planoTipo = 'anual';
  }
 
  console.log(
    `[mp-webhook] preapproval=${preapprovalId} user=${userId} status=${preapproval.status} plano=${planoTipo}`
  );
 
  // ===== Upsert na tabela assinaturas =====
  const { error: upsertError } = await supabase
    .from('assinaturas')
    .upsert(
      {
        user_id: userId,
        mp_preapproval_id: preapproval.id,
        mp_preapproval_plan_id: preapproval.preapproval_plan_id || '',
        plano_tipo: planoTipo,
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
    await ativarPremium(userId, supabase);
    console.log(`[mp-webhook] user ${userId} virou Premium`);
  } else if (preapproval.status === 'cancelled') {
    // So aplica grace period se ainda nao foi aplicado (evita re-cancelar
    // se o webhook chegar duplicado)
    const { data: perfil } = await supabase
      .from('profiles')
      .select('plano, cancelado_em')
      .eq('id', userId)
      .single();
 
    if (perfil?.plano === 'premium' || !perfil?.cancelado_em) {
      await marcarCancelamentoPremium(userId, supabase);
      console.log(`[mp-webhook] user ${userId} cancelado, grace de 30 dias iniciado`);
    } else {
      console.log(`[mp-webhook] user ${userId} ja estava cancelado, sem dupla acao`);
    }
  } else if (preapproval.status === 'paused') {
    console.log(`[mp-webhook] user ${userId} pausado (pagamento pendente)`);
    // Por ora nao mudamos o plano. Em Wave futura podemos notificar usuario.
  } else if (preapproval.status === 'pending') {
    console.log(`[mp-webhook] user ${userId} ainda pending (cadastrando cartao)`);
  }
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