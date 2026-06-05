/**
 * Webhook Pluggy: recebe eventos automaticos.
 *
 * Modo de operacao via env vars:
 *   - PLUGGY_WEBHOOK_SECRET   -> chave HMAC para validar assinatura
 *   - PLUGGY_WEBHOOK_STRICT   -> 'true' rejeita sem assinatura valida
 *   - PLUGGY_WEBHOOK_VERBOSE  -> 'true' loga payload completo e headers
 *
 * Em modo padrao (sem strict, sem verbose): so loga essencial.
 *
 * Eventos tratados:
 *   - item/updated, item/created, transactions/*  -> sincroniza
 *   - item/error, item/login_failed               -> marca erro + notifica
 *   - item/waiting_user_input                     -> marca MFA + notifica
 *   - item/deleted                                -> remove conexao
 */
 
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { sincronizarUmaConexao } from '@/lib/sincronizar';
 
export const maxDuration = 60;
 
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
 
const SIGNING_SECRET = process.env.PLUGGY_WEBHOOK_SECRET || '';
const STRICT_MODE = process.env.PLUGGY_WEBHOOK_STRICT === 'true';
const VERBOSE_MODE = process.env.PLUGGY_WEBHOOK_VERBOSE === 'true';
 
function validarAssinatura(rawBody: string, assinatura: string): boolean {
  if (!SIGNING_SECRET || !assinatura) return false;
 
  const esperado = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(rawBody)
    .digest('hex');
 
  try {
    const a = Buffer.from(assinatura, 'hex');
    const b = Buffer.from(esperado, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
 
export async function GET() {
  return NextResponse.json({
    status: 'webhook endpoint ativo',
    modoStrict: STRICT_MODE,
    modoVerbose: VERBOSE_MODE,
    secretConfigurado: !!SIGNING_SECRET,
  });
}
 
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
 
    // ===== LOG VERBOSO (so se PLUGGY_WEBHOOK_VERBOSE=true) =====
    if (VERBOSE_MODE) {
      const headersRecebidos: Record<string, string> = {};
      request.headers.forEach((valor, chave) => {
        headersRecebidos[chave] = valor;
      });
      console.log('[webhook] Headers:', JSON.stringify(headersRecebidos));
      console.log('[webhook] Body (500 chars):', rawBody.slice(0, 500));
    }
 
    // Procura assinatura em headers comuns
    const possiveisHeaders = [
      'x-signature',
      'x-pluggy-signature',
      'signature',
      'x-hub-signature',
      'x-hub-signature-256',
      'x-webhook-signature',
    ];
    const sig =
      possiveisHeaders.map((h) => request.headers.get(h)).find((v) => v) || '';
 
    // ===== VALIDACAO (so bloqueia em strict mode) =====
    if (SIGNING_SECRET && sig) {
      const valida = validarAssinatura(rawBody, sig);
      if (!valida) {
        console.warn('[webhook] Assinatura invalida');
        if (STRICT_MODE) {
          return NextResponse.json({ erro: 'Assinatura invalida' }, { status: 401 });
        }
      }
    } else if (STRICT_MODE) {
      console.warn('[webhook] STRICT mode + sem secret ou assinatura');
      return NextResponse.json(
        { erro: 'Webhook nao configurado ou sem assinatura' },
        { status: 401 }
      );
    }
 
    // ===== PARSE =====
    let payload: {
      event?: string;
      eventType?: string;
      itemId?: string;
      data?: Record<string, unknown>;
      error?: Record<string, unknown>;
    };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ erro: 'Payload invalido' }, { status: 400 });
    }
 
    const eventType: string = payload.event || payload.eventType || '';
    const itemId: string | undefined =
      payload.itemId ||
      (payload.data && typeof payload.data.itemId === 'string'
        ? payload.data.itemId
        : undefined);
 
    if (!itemId) {
      return NextResponse.json({
        recebido: true,
        evento: eventType,
        ignorado: 'sem_item',
      });
    }
 
    // ===== BUSCA CONEXAO =====
    const { data: conexao } = await supabase
      .from('connections')
      .select('id, user_id, pluggy_item_id, connector_name')
      .eq('pluggy_item_id', itemId)
      .single();
 
    if (!conexao) {
      // Log so quando algo nao bate (caso util de debug)
      console.log(`[webhook] conexao nao encontrada: item=${itemId} evento=${eventType}`);
      return NextResponse.json({
        recebido: true,
        evento: eventType,
        ignorado: 'conexao_nao_encontrada',
      });
    }
 
    let acao = 'nenhuma';
 
    // ===== SYNC EVENTS =====
    if (
      eventType === 'item/updated' ||
      eventType === 'item/created' ||
      eventType === 'transactions/created' ||
      eventType === 'transactions/updated' ||
      eventType === 'transactions/deleted'
    ) {
      acao = 'sincronizado';
      await sincronizarUmaConexao(conexao);
      // ATENCAO: webhook NAO cria notificacao "Suas transacoes foram atualizadas"
      // pra evitar spam. Notificacao so e gerada por sync manual do usuario
      // ou por eventos de erro/MFA abaixo.
    }
    // ===== ERROR EVENTS =====
    else if (
      eventType === 'item/error' ||
      eventType === 'item/login_failed' ||
      eventType === 'item/login_error'
    ) {
      acao = 'erro_registrado';
      let mensagem = 'Erro na conexao bancaria';
      if (payload.data && typeof payload.data.message === 'string') {
        mensagem = payload.data.message;
      } else if (payload.error && typeof payload.error.message === 'string') {
        mensagem = payload.error.message;
      }
 
      await supabase
        .from('connections')
        .update({ status: 'ERROR', erro: mensagem.slice(0, 500) })
        .eq('id', conexao.id);
 
      await supabase.from('notificacoes').insert({
        user_id: conexao.user_id,
        tipo: 'banco_erro',
        titulo: 'Problema na conexão bancária',
        mensagem: `Sua conta no ${conexao.connector_name || 'banco'} apresentou um erro. Acesse "Conectar" para reconectar.`,
      });
    }
    // ===== MFA =====
    else if (
      eventType === 'item/waiting_user_input' ||
      eventType === 'item/login_mfa_required'
    ) {
      acao = 'mfa_solicitado';
      await supabase
        .from('connections')
        .update({ status: 'WAITING_INPUT' })
        .eq('id', conexao.id);
 
      await supabase.from('notificacoes').insert({
        user_id: conexao.user_id,
        tipo: 'banco_mfa',
        titulo: 'Reconexão bancária necessária',
        mensagem: `O ${conexao.connector_name || 'banco'} pediu uma nova confirmação. Acesse "Conectar" para revalidar.`,
      });
    }
    // ===== DELETED =====
    else if (eventType === 'item/deleted') {
      acao = 'removido';
      await supabase.from('connections').delete().eq('id', conexao.id);
    }
 
    // Log essencial (sempre)
    console.log(`[webhook] ${eventType} item=${itemId} acao=${acao}`);
 
    return NextResponse.json({
      recebido: true,
      evento: eventType,
      itemId,
      acao,
    });
  } catch (e) {
    console.error('[webhook] Erro processando:', e);
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 });
  }
}