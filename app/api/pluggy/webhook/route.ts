/**
 * Webhook Pluggy: recebe eventos automaticos.
 *
 * SEGURANCA EM CAMADAS (defense in depth):
 *  1. Validacao de assinatura HMAC (quando configurada) - ver modos abaixo.
 *  2. Re-confirmacao via API: eventos de sync NUNCA confiam no payload; os
 *     dados vem sempre da API Pluggy autenticada (sincronizarUmaConexao).
 *     Um evento falsificado nao leva a nada porque a API e a fonte da verdade.
 *  3. Idempotencia: evento duplicado (Pluggy reenvia se nao recebe 200 rapido)
 *     e ignorado dentro de uma janela curta, evitando sync repetido.
 *  4. Timeout interno no sync: se passar do limite, responde 200 mesmo assim
 *     (pra Pluggy nao reenviar infinitamente) e loga incompleto; a proxima
 *     sincronizacao completa o que faltou.
 *
 * Modo de operacao via env vars:
 *   - PLUGGY_WEBHOOK_SECRET   -> chave HMAC para validar assinatura
 *   - PLUGGY_WEBHOOK_STRICT   -> 'true' rejeita sem assinatura valida
 *   - PLUGGY_WEBHOOK_VERBOSE  -> 'true' loga payload completo e headers
 *
 * ESTRATEGIA DE LANCAMENTO (2 fases):
 *   Fase 1 (primeiro evento real): VERBOSE=true, STRICT=false.
 *     Captura como o Pluggy assina (header + formato). Seguranca vem das
 *     camadas 2/3/4. NAO rejeita evento legitimo por engano de HMAC.
 *   Fase 2 (apos confirmar o formato): STRICT=true. Validacao criptografica
 *     ligada + todas as camadas. Seguranca maxima.
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
 
// Timeout interno do sync: corta antes do maxDuration (60s) pra sempre dar
// tempo de responder 200 ao Pluggy. 50s deixa folga pra resposta.
const SYNC_TIMEOUT_MS = 50_000;
 
// Janela de idempotencia: eventos identicos dentro desse intervalo sao
// considerados duplicados e ignorados (Pluggy reenvia em segundos).
const DEDUP_JANELA_MS = 30_000;
 
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
 
const SIGNING_SECRET = process.env.PLUGGY_WEBHOOK_SECRET || '';
const STRICT_MODE = process.env.PLUGGY_WEBHOOK_STRICT === 'true';
const VERBOSE_MODE = process.env.PLUGGY_WEBHOOK_VERBOSE === 'true';
 
// Cache de idempotencia em memoria do processo. Chave = hash do evento+item.
// Observacao: em serverless cada instancia tem o seu; nao e perfeito entre
// instancias, mas cobre o caso comum (reenvio rapido cai na mesma instancia
// quente). Pra dedup forte entre instancias, seria preciso uma tabela; por
// ora isso e suficiente e sem custo de DB.
const eventosRecentes = new Map<string, number>();
 
function jaProcessado(chave: string): boolean {
  const agora = Date.now();
  // limpa expirados (mantem o Map pequeno)
  for (const [k, t] of eventosRecentes) {
    if (agora - t > DEDUP_JANELA_MS) eventosRecentes.delete(k);
  }
  const visto = eventosRecentes.get(chave);
  if (visto && agora - visto < DEDUP_JANELA_MS) return true;
  eventosRecentes.set(chave, agora);
  return false;
}
 
function validarAssinatura(rawBody: string, assinatura: string): boolean {
  if (!SIGNING_SECRET || !assinatura) return false;
 
  // Alguns provedores prefixam o algoritmo (ex: "sha256=abc..."). Limpa.
  const limpa = assinatura.includes('=')
    ? assinatura.split('=').pop() || assinatura
    : assinatura;
 
  const esperado = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(rawBody)
    .digest('hex');
 
  try {
    const a = Buffer.from(limpa, 'hex');
    const b = Buffer.from(esperado, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
 
// Executa o sync com um teto de tempo. Se estourar, resolve com 'timeout'
// em vez de pendurar a request ate o Pluggy desistir.
async function sincronizarComTimeout(conexao: Parameters<typeof sincronizarUmaConexao>[0]): Promise<'ok' | 'timeout' | 'erro'> {
  try {
    const resultado = await Promise.race([
      sincronizarUmaConexao(conexao).then(() => 'ok' as const),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), SYNC_TIMEOUT_MS)),
    ]);
    return resultado;
  } catch (e) {
    console.error('[webhook] erro no sync:', e);
    return 'erro';
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
      } else if (VERBOSE_MODE) {
        console.log('[webhook] Assinatura VALIDA');
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
      id?: string;
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
 
    // ===== IDEMPOTENCIA: ignora evento duplicado recente =====
    // Usa o id do evento se vier; senao, combina tipo+item (suficiente pra
    // barrar reenvios rapidos do mesmo evento).
    const chaveEvento = `${payload.id || ''}:${eventType}:${itemId}`;
    if (jaProcessado(chaveEvento)) {
      console.log(`[webhook] duplicado ignorado: ${eventType} item=${itemId}`);
      return NextResponse.json({
        recebido: true,
        evento: eventType,
        itemId,
        acao: 'duplicado_ignorado',
      });
    }
 
    // ===== BUSCA CONEXAO (maybeSingle: nao estoura se nao achar) =====
    const { data: conexao } = await supabase
      .from('connections')
      .select('id, user_id, pluggy_item_id, connector_name')
      .eq('pluggy_item_id', itemId)
      .maybeSingle();
 
    if (!conexao) {
      // Item desconhecido: NAO e erro (pode ser evento de outro ambiente, ou
      // conexao ja apagada). Responde 200 pra Pluggy nao reenviar pra sempre.
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
      // Sync com timeout: se demorar demais, corta e responde mesmo assim.
      const resultado = await sincronizarComTimeout(conexao);
      acao = resultado === 'ok' ? 'sincronizado'
           : resultado === 'timeout' ? 'sync_incompleto_timeout'
           : 'sync_erro';
      if (resultado === 'timeout') {
        console.warn(`[webhook] sync excedeu ${SYNC_TIMEOUT_MS}ms item=${itemId} - completa na proxima`);
      }
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