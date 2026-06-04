/**
 * Webhook Pluggy: recebe eventos automaticos.
 *
 * VERSAO DE DESCOBERTA (Wave 6.6 - parte 1):
 * - Aceita webhooks SEM exigir assinatura por enquanto
 * - Loga todos os headers recebidos pra descobrir como a Pluggy assina
 * - Para virar "strict" depois: setar PLUGGY_WEBHOOK_STRICT=true
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
 
// GET pra confirmar que a rota esta de pe
export async function GET() {
  return NextResponse.json({
    status: 'webhook endpoint ativo',
    modoDescoberta: !STRICT_MODE,
    secretConfigurado: !!SIGNING_SECRET,
  });
}
 
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
 
    // ====== LOG VERBOSO: imprime TODOS os headers pra descobrirmos a assinatura ======
    const headersRecebidos: Record<string, string> = {};
    request.headers.forEach((valor, chave) => {
      headersRecebidos[chave] = valor;
    });
 
    console.log('[webhook] === NOVO WEBHOOK RECEBIDO ===');
    console.log('[webhook] Headers:', JSON.stringify(headersRecebidos, null, 2));
    console.log('[webhook] Body (primeiros 500 chars):', rawBody.slice(0, 500));
 
    // Procura possíveis nomes de header de assinatura (vamos descobrir qual a Pluggy usa)
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
    console.log('[webhook] Assinatura encontrada (algum header):', sig || '(nenhuma)');
 
    // ====== VALIDACAO (so bloqueia em strict mode) ======
    if (SIGNING_SECRET && sig) {
      const valida = validarAssinatura(rawBody, sig);
      if (!valida) {
        console.warn('[webhook] Assinatura INVALIDA com o secret atual');
        if (STRICT_MODE) {
          return NextResponse.json({ erro: 'Assinatura invalida' }, { status: 401 });
        }
        console.log('[webhook] Continuando mesmo assim (modo descoberta)');
      } else {
        console.log('[webhook] Assinatura validada ✓');
      }
    } else if (STRICT_MODE) {
      console.warn('[webhook] STRICT mode + sem secret OU sem assinatura no header');
      return NextResponse.json(
        { erro: 'Webhook nao configurado ou sem assinatura' },
        { status: 401 }
      );
    }
 
    // ====== PARSE DO PAYLOAD ======
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
 
    console.log(`[webhook] Evento: ${eventType} | Item: ${itemId || 'N/A'}`);
 
    if (!itemId) {
      return NextResponse.json({
        recebido: true,
        evento: eventType,
        ignorado: 'sem_item',
      });
    }
 
    // ====== BUSCA CONEXAO ======
    const { data: conexao } = await supabase
      .from('connections')
      .select('id, user_id, pluggy_item_id, connector_name')
      .eq('pluggy_item_id', itemId)
      .single();
 
    if (!conexao) {
      console.log(`[webhook] Conexao para item ${itemId} nao encontrada`);
      return NextResponse.json({
        recebido: true,
        evento: eventType,
        ignorado: 'conexao_nao_encontrada',
      });
    }
 
    // ====== PROCESSAMENTO POR TIPO DE EVENTO ======
    let acao = 'nenhuma';
 
    if (
      eventType === 'item/updated' ||
      eventType === 'item/created' ||
      eventType === 'transactions/created' ||
      eventType === 'transactions/updated' ||
      eventType === 'transactions/deleted'
    ) {
      acao = 'sincronizado';
      const resultado = await sincronizarUmaConexao(conexao);
 
      if (resultado.totalTransacoes > 0) {
        await supabase.from('notificacoes').insert({
          user_id: conexao.user_id,
          tipo: 'banco_sincronizado',
          titulo: 'Suas transações foram atualizadas',
          mensagem: `${resultado.totalTransacoes} transação(ões) atualizada(s) no ${conexao.connector_name || 'banco'}.`,
        });
      }
    } else if (
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
    } else if (
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
    } else if (eventType === 'item/deleted') {
      acao = 'removido';
      await supabase.from('connections').delete().eq('id', conexao.id);
    }
 
    console.log(`[webhook] Acao: ${acao}`);
 
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