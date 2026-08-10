/**
 * Push do servidor (lib/push.ts) - menta-app (web) - BLOCO 1.
 *
 * Envia notificacao push pra um usuario via Expo Push Service (gratuito).
 * Disparado por EVENTO (fatura analisada, limite atingido), sem cron.
 *
 * Busca os tokens do usuario em push_tokens e faz POST pro Expo.
 * Se o usuario nao tem token (nao deu permissao), simplesmente nao envia.
 */

import { createClient } from '@supabase/supabase-js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Cliente admin (service role) pra ler tokens de qualquer usuario no backend.
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

type Mensagem = {
  titulo: string;
  corpo: string;
  dados?: Record<string, unknown>; // payload opcional (ex: rota pra abrir)
};

/**
 * Envia push pra um usuario. Nao lanca erro pra nao quebrar o fluxo que
 * chamou (a notificacao e um "extra", nao pode derrubar a analise).
 */
export async function enviarPush(userId: string, msg: Mensagem): Promise<void> {
  try {
    const supabase = admin();

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId);

    if (!tokens || tokens.length === 0) return; // usuario sem token, nada a fazer

    // monta 1 mensagem por token (o usuario pode ter varios dispositivos)
    const mensagens = tokens.map((t: { token: string }) => ({
      to: t.token,
      sound: 'default',
      title: msg.titulo,
      body: msg.corpo,
      data: msg.dados || {},
    }));

    const resp = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mensagens),
    });

    if (!resp.ok) {
      console.warn('[push] Expo respondeu', resp.status);
    }
  } catch (e) {
    console.warn('[push] falha ao enviar:', e);
  }
}