/**
 * Webhook Pluggy: recebe eventos automaticos quando bancos atualizam.
 *
 * Eventos tratados:
 *   - item/updated, item/created, transactions/*  -> sincroniza
 *   - item/error, item/login_failed               -> marca erro + notifica
 *   - item/waiting_user_input                     -> marca MFA + notifica
 *   - item/deleted                                -> remove conexao
 *
 * Seguranca:
 *   - Valida assinatura HMAC-SHA256 com PLUGGY_WEBHOOK_SECRET
 *   - SEM auth de usuario (Pluggy nao tem JWT do usuario)
 *
 * Importante:
 *   - Webhook so funciona em URL publica HTTPS (Vercel)
 *   - Localhost nao recebe webhooks da Pluggy
 *   - PLUGGY_WEBHOOK_SECRET deve estar em .env.local E nas variaveis Vercel
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
 
function validarAssinatura(rawBody: string, assinatura: string): boolean {
  if (!SIGNING_SECRET) return false;
  if (!assinatura) return false;
 
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
 
// GET pra confirmar que a rota esta de pe (util quando testar URL)
export async function GET() {
  return NextResponse.json({
    status: 'webhook endpoint ativo',
    configurado: SIGNING_SECRET ? true : false,
  });
}
 
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
 
    // Pluggy pode mandar a assinatura em headers diferentes; tentamos comum
    const sig =
      request.headers.get('x-signature') ||
      request.headers.get('x-pluggy-signature') ||
      request.headers.get('signature') ||
      '';
 
    // Em producao, exigimos o secret. Sem ele, rejeitamos.
    if (!SIGNING_SECRET) {
      console.error('[webhook] PLUGGY_WEBHOOK_SECRET nao configurado');
      return NextResponse.json(
        { erro: 'Webhook nao configurado no servidor' },
        { status: 500 }
      );
    }
 
    if (!validarAssinatura(rawBody, sig)) {
      console.warn('[webhook] Assinatura invalida ou ausente');
      return NextResponse.json({ erro: 'Assinatura invalida' }, { status: 401 });
    }
 
    let payload: { event?: string; eventType?: string; itemId?: string; data?: Record<string, unknown>; error?: Record<string, unknown> };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ erro: 'Payload invalido' }, { status: 400 });
    }
 
    const eventType: string = payload.event || payload.eventType || '';
    const itemId: string | undefined =
      payload.itemId ||
      (payload.data && typeof payload.data.itemId === 'string' ? payload.data.itemId : undefined);
 
    console.log(`[webhook] Recebido: evento=${eventType} itemId=${itemId || 'N/A'}`);
 
    if (!itemId) {
      // Webhook de teste ou evento sem itemId
      return NextResponse.json({ recebido: true, evento: eventType, ignorado: 'sem_item' });
    }
 
    // Busca conexao no nosso DB
    const { data: conexao } = await supabase
      .from('connections')
      .select('id, user_id, pluggy_item_id, connector_name')
      .eq('pluggy_item_id', itemId)
      .single();
 
    if (!conexao) {
      // Conexao nao registrada na nossa base (ainda); ignora silenciosamente
      console.log(`[webhook] Conexao para item ${itemId} nao encontrada, ignorando`);
      return NextResponse.json({
        recebido: true,
        evento: eventType,
        ignorado: 'conexao_nao_encontrada',
      });
    }
 
    let acao = 'nenhuma';
 
    // === Eventos que disparam sync ===
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
    }
 
    // === Eventos de erro ===
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
 
    // === MFA / aguardando input ===
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
 
    // === Conexao deletada na Pluggy ===
    else if (eventType === 'item/deleted') {
      acao = 'removido';
      // Cascade cuida das tabelas filhas
      await supabase.from('connections').delete().eq('id', conexao.id);
    }
 
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